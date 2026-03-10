import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, Output } from 'ai';
import { z } from 'zod';

import { createTranslator, getCurrentLocale } from '@/src/shared/i18n';
import { messaging } from '@/src/shared/messaging';
import { openSettingsPage } from '@/src/shared/open-settings-page';
import { getSettings, toOriginPermissionPattern } from '@/src/shared/settings';
import type {
  BookmarkSuggestion,
  BookmarkSuggestionUiConfig,
  BookmarkSuggestionUpdatePayload,
  DuplicateBookmarkAction,
  DuplicateBookmarkMatch,
  FlowmarkSettings,
  PageContent,
} from '@/src/shared/types';

type BookmarkTreeNode = {
  id: string;
  title: string;
  url?: string | undefined;
  children?: BookmarkTreeNode[] | undefined;
  parentId?: string | undefined;
};

type PendingBookmark = {
  bookmarkId: string;
  url: string;
  originalTitle: string;
  tabId: number;
  pageContentPromise: Promise<PageContent>;
};

const PENDING_CONFIRM_DELAY_MS = 1500;
const APPLY_SUPPRESS_TTL_MS = 8000;
const DUPLICATE_ACTION_SUPPRESS_TTL_MS = 4000;
const MAX_FOLDER_PATHS = 300;
const MAX_FOLDER_DEPTH = 4;
const MAX_HEADINGS = 8;
const MAX_DUPLICATE_MATCHES = 3;

const suggestionSchema = z
  .object({
    suggestedFolder: z.string(),
    title: z.string(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export function initBookmarkRecommendation(): void {
  const pending = new Map<string, PendingBookmark>();
  const queue: string[] = [];
  const suppressUntil = new Map<string, number>();

  let draining = false;

  browser.bookmarks.onCreated.addListener(async (id, node) => {
    if (!node.url) return;

    const settings = await getSettings();
    if (!settings.enabled) return;
    if (isSuppressed(id, suppressUntil)) return;

    const tabId = await getActiveTabId();
    if (tabId == null) return;

    pending.set(id, {
      bookmarkId: id,
      url: node.url,
      originalTitle: node.title ?? '',
      tabId,
      pageContentPromise: fetchPageContent(tabId, settings, node.url),
    });

    setTimeout(() => {
      queue.push(id);
      void drainQueue();
    }, PENDING_CONFIRM_DELAY_MS);
  });

  messaging.onMessage('applyBookmarkSuggestion', async ({ data }) => {
    suppressUntil.set(data.bookmarkId, Date.now() + APPLY_SUPPRESS_TTL_MS);

    const barId = await getBookmarksBarId();
    if (barId == null) return;

    const parentId = await findOrCreateFolderPath(barId, data.suggestedFolder);
    await browser.bookmarks.move(data.bookmarkId, { parentId });
    await browser.bookmarks.update(data.bookmarkId, { title: data.title });
  });

  messaging.onMessage('rejectBookmarkSuggestion', ({ data }) => {
    suppressUntil.set(data.bookmarkId, Date.now() + 2_000);
  });

  messaging.onMessage('resolveDuplicateBookmark', async ({ data }) => {
    pending.delete(data.bookmarkId);
    suppressUntil.set(data.bookmarkId, Date.now() + DUPLICATE_ACTION_SUPPRESS_TTL_MS);
    await resolveDuplicateBookmark(data.bookmarkId, data.action, data.targetBookmarkId);
  });

  messaging.onMessage('dismissDuplicateBookmark', ({ data }) => {
    pending.delete(data.bookmarkId);
    suppressUntil.set(data.bookmarkId, Date.now() + DUPLICATE_ACTION_SUPPRESS_TTL_MS);
  });

  messaging.onMessage('openBookmark', async ({ data }) => {
    await openBookmarkById(data.bookmarkId);
  });

  messaging.onMessage('openOptions', async () => {
    await openSettingsPage();
  });

  async function drainQueue(): Promise<void> {
    if (draining) return;
    draining = true;

    try {
      while (queue.length > 0) {
        const bookmarkId = queue.shift();
        if (!bookmarkId) continue;

        const job = pending.get(bookmarkId);
        if (!job) continue;

        pending.delete(bookmarkId);

        const stillExists = await bookmarkExists(bookmarkId);
        if (!stillExists) continue;

        const settings = await getSettings();
        if (!settings.enabled) continue;
        if (isSuppressed(bookmarkId, suppressUntil)) continue;

        const ui = toUiConfig(settings);
        const locale = await getCurrentLocale(settings);
        const { t } = createTranslator(locale);

        if (settings.duplicateCheckEnabled) {
          const duplicates = await detectDuplicateBookmarks(bookmarkId, job.url, t('common.bookmarksBar'), t('common.untitled'));
          if (duplicates.length > 0) {
            void sendUiUpdate(job.tabId, {
              kind: 'duplicate',
              bookmarkId,
              url: job.url,
              title: job.originalTitle || t('common.bookmark'),
              matches: duplicates,
              ui,
            });
            continue;
          }
        }

        const configError = await getAiConfigError(settings, t);
        if (configError) {
          void sendUiUpdate(job.tabId, {
            kind: 'error',
            bookmarkId,
            url: job.url,
            title: job.originalTitle || t('common.bookmark'),
            message: configError.message,
            ui,
            canOpenOptions: configError.canOpenOptions,
          });
          continue;
        }

        void sendUiUpdate(job.tabId, {
          kind: 'loading',
          bookmarkId,
          url: job.url,
          title: job.originalTitle || t('common.saving'),
          ui,
        });

        const [pageContent, folderPaths] = await Promise.all([
          job.pageContentPromise,
          collectFolderPaths(),
        ]);

        const suggestion = await getSuggestion(settings, {
          url: job.url,
          originalTitle: job.originalTitle,
          pageContent,
          folderPaths,
          untitledFallback: t('common.untitled'),
        });

        if (!suggestion) {
          void sendUiUpdate(job.tabId, {
            kind: 'error',
            bookmarkId,
            url: job.url,
            title: job.originalTitle || t('common.bookmark'),
            message: t('background.failedRecommendation'),
            ui,
            canOpenOptions: false,
          });
          continue;
        }

        void sendUiUpdate(job.tabId, {
          kind: 'ready',
          bookmarkId,
          url: job.url,
          title: suggestion.title,
          suggestion,
          ui,
        });
      }
    } finally {
      draining = false;
    }
  }
}

function isSuppressed(bookmarkId: string, suppressUntil: Map<string, number>): boolean {
  const until = suppressUntil.get(bookmarkId);
  if (until == null) return false;
  if (Date.now() < until) return true;
  suppressUntil.delete(bookmarkId);
  return false;
}

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function sendUiUpdate(tabId: number, payload: BookmarkSuggestionUpdatePayload): Promise<void> {
  try {
    await messaging.sendMessage('bookmarkSuggestionUpdate', payload, tabId);
  } catch {
    // Ignore tabs without a mounted content script.
  }
}

function toUiConfig(settings: FlowmarkSettings): BookmarkSuggestionUiConfig {
  return {
    autoAcceptEnabled: settings.autoAcceptEnabled,
    autoAcceptSeconds: settings.autoAcceptSeconds,
  };
}

async function fetchPageContent(tabId: number, settings: FlowmarkSettings, url: string): Promise<PageContent> {
  try {
    return await messaging.sendMessage(
      'getPageContent',
      { includeText: settings.sendPageText, maxChars: settings.maxPageChars },
      tabId,
    );
  } catch {
    return {
      url,
      title: '',
      description: '',
      headings: [],
      text: null,
    };
  }
}

async function bookmarkExists(bookmarkId: string): Promise<boolean> {
  try {
    const nodes = await browser.bookmarks.get(bookmarkId);
    return nodes.length > 0;
  } catch {
    return false;
  }
}

async function getBookmarksBarId(): Promise<string | null> {
  const tree = await browser.bookmarks.getTree();
  const root = tree[0];
  const bar = root?.children?.[0];
  return bar?.id ?? null;
}

async function collectFolderPaths(): Promise<string[]> {
  const barId = await getBookmarksBarId();
  if (!barId) return [];

  const rootChildren = await browser.bookmarks.getChildren(barId);
  const paths: string[] = [];
  const stack: Array<{ node: BookmarkTreeNode; path: string; depth: number }> = [];

  for (const child of rootChildren) {
    if (!child.url) stack.push({ node: child, path: child.title, depth: 1 });
  }

  while (stack.length > 0 && paths.length < MAX_FOLDER_PATHS) {
    const item = stack.pop();
    if (!item) break;

    paths.push(item.path);
    if (item.depth >= MAX_FOLDER_DEPTH) continue;

    const children = await browser.bookmarks.getChildren(item.node.id);
    for (const child of children) {
      if (child.url) continue;
      const title = child.title?.trim();
      if (!title) continue;
      stack.push({
        node: child,
        path: `${item.path}-${title}`,
        depth: item.depth + 1,
      });
    }
  }

  return paths.slice(0, MAX_FOLDER_PATHS);
}

async function detectDuplicateBookmarks(
  bookmarkId: string,
  url: string,
  bookmarksBarLabel: string,
  untitledLabel: string,
): Promise<DuplicateBookmarkMatch[]> {
  const normalizedTarget = normalizeBookmarkUrl(url);
  if (!normalizedTarget) return [];

  const tree = await browser.bookmarks.getTree();
  const root = tree[0];
  const bookmarksBarId = root?.children?.[0]?.id ?? null;
  const matches: Array<DuplicateBookmarkMatch & { depth: number }> = [];

  for (const child of root?.children ?? []) {
    if (child.id === bookmarksBarId) {
      for (const grandchild of child.children ?? []) {
        collectDuplicateMatches(grandchild, [], normalizedTarget, bookmarkId, matches, bookmarksBarLabel, untitledLabel);
      }
      continue;
    }

    collectDuplicateMatches(child, [], normalizedTarget, bookmarkId, matches, bookmarksBarLabel, untitledLabel);
  }

  return matches
    .sort((a, b) => a.depth - b.depth || a.folderPath.localeCompare(b.folderPath) || a.title.localeCompare(b.title))
    .slice(0, MAX_DUPLICATE_MATCHES)
    .map(({ depth: _depth, ...match }) => match);
}

function collectDuplicateMatches(
  node: BookmarkTreeNode,
  folderPathParts: string[],
  normalizedTarget: string,
  currentBookmarkId: string,
  matches: Array<DuplicateBookmarkMatch & { depth: number }>,
  bookmarksBarLabel: string,
  untitledLabel: string,
): void {
  if (node.url) {
    const normalizedNodeUrl = normalizeBookmarkUrl(node.url);
    if (node.id !== currentBookmarkId && normalizedNodeUrl === normalizedTarget) {
      const relativeParts = folderPathParts.filter((part) => part.length > 0);
      matches.push({
        id: node.id,
        title: trimTitle(node.title) || untitledLabel,
        url: node.url,
        folderPath: relativeParts.join('-') || bookmarksBarLabel,
        depth: relativeParts.length,
      });
    }
    return;
  }

  const nextParts = node.title ? [...folderPathParts, trimTitle(node.title)] : [...folderPathParts];
  for (const child of node.children ?? []) {
    collectDuplicateMatches(child, nextParts, normalizedTarget, currentBookmarkId, matches, bookmarksBarLabel, untitledLabel);
  }
}

function normalizeBookmarkUrl(input: string): string | null {
  try {
    const url = new URL(input);
    url.hash = '';
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function trimTitle(title: string | undefined): string {
  return title?.trim() ?? '';
}

async function getAiConfigError(
  settings: FlowmarkSettings,
  t: (key: 'background.aiNotConfigured' | 'background.hostPermissionNotGranted' | 'background.invalidAiBaseUrl') => string,
): Promise<{ message: string; canOpenOptions: boolean } | null> {
  if (!settings.aiBaseURL || !settings.aiModel) {
    return {
      message: t('background.aiNotConfigured'),
      canOpenOptions: true,
    };
  }

  try {
    const originPattern = toOriginPermissionPattern(settings.aiBaseURL);
    const granted = await browser.permissions.contains({ origins: [originPattern] });
    if (!granted) {
      return {
        message: t('background.hostPermissionNotGranted'),
        canOpenOptions: true,
      };
    }
  } catch {
    return {
      message: t('background.invalidAiBaseUrl'),
      canOpenOptions: true,
    };
  }

  return null;
}

async function getSuggestion(
  settings: FlowmarkSettings,
  input: {
    url: string;
    originalTitle: string;
    pageContent: PageContent;
    folderPaths: string[];
    untitledFallback: string;
  },
): Promise<BookmarkSuggestion | null> {
  const provider = createOpenAICompatible({
    name: 'flowmark',
    baseURL: settings.aiBaseURL,
    apiKey: settings.aiApiKey.trim() || undefined,
  });

  const model = provider.chatModel(settings.aiModel);
  const pageTitle = input.pageContent.title || input.originalTitle;
  const headings = input.pageContent.headings.slice(0, MAX_HEADINGS);

  const system =
    'You are a bookmark organizer. Return a JSON object with a suggested folder path and a short improved title.' +
    '\nRules:' +
    '\n- suggestedFolder must be a "-" separated relative path (do NOT include the bookmarks bar root name).' +
    '\n- Keep suggestedFolder to at most 4 segments.' +
    '\n- Prefer choosing an existing folder path from the provided list.' +
    '\n- title must be short, readable, and not include extra quotes.' +
    '\n- confidence must be a number between 0 and 1.';

  const promptParts: string[] = [];
  promptParts.push(`URL: ${input.url}`);
  if (pageTitle) promptParts.push(`Page title: ${pageTitle}`);
  if (input.pageContent.description) promptParts.push(`Description: ${input.pageContent.description}`);
  if (headings.length > 0) promptParts.push(`Headings: ${headings.join(' | ')}`);
  if (input.pageContent.text) promptParts.push(`Page text (truncated):\n${input.pageContent.text}`);
  promptParts.push('Existing folders (use one of these if possible):');
  promptParts.push(input.folderPaths.join('\n'));

  try {
    const prompt = promptParts.join('\n\n');

    try {
      const result = await generateText({
        model,
        system,
        prompt,
        temperature: 0.2,
        maxOutputTokens: 200,
        output: Output.object({
          schema: suggestionSchema,
        }),
      });

      const parsed = suggestionSchema.safeParse(result.output);
      if (parsed.success) return normalizeSuggestion(parsed.data, input.untitledFallback);
    } catch {
      // Fall back to plain JSON parsing for providers without structured outputs.
    }

    const { text } = await generateText({
      model,
      system: `${system}\n\nReturn ONLY valid JSON.`,
      prompt,
      temperature: 0.2,
      maxOutputTokens: 220,
    });

    const json = extractFirstJsonObject(text);
    if (!json) return null;

    const parsed = suggestionSchema.safeParse(json);
    if (!parsed.success) return null;

    return normalizeSuggestion(parsed.data, input.untitledFallback);
  } catch {
    return null;
  }
}

function normalizeSuggestion(value: BookmarkSuggestion, untitledFallback: string): BookmarkSuggestion {
  const folder = value.suggestedFolder
    .split(/[-/]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, 4)
    .join('-');
  const title = value.title.trim().slice(0, 160);
  const confidence = Number.isFinite(value.confidence)
    ? Math.min(1, Math.max(0, value.confidence))
    : 0;

  return {
    suggestedFolder: folder,
    title: title.length > 0 ? title : untitledFallback,
    confidence,
  };
}

function extractFirstJsonObject(text: string): unknown | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

async function findOrCreateFolderPath(bookmarksBarId: string, folderPath: string): Promise<string> {
  const parts = folderPath
    .split('-')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) return bookmarksBarId;

  let currentParentId = bookmarksBarId;
  for (const part of parts) {
    const children = await browser.bookmarks.getChildren(currentParentId);
    const existing = children.find((child) => !child.url && child.title === part);
    if (existing) {
      currentParentId = existing.id;
      continue;
    }

    const created = await browser.bookmarks.create({ parentId: currentParentId, title: part });
    currentParentId = created.id;
  }

  return currentParentId;
}

async function resolveDuplicateBookmark(
  bookmarkId: string,
  action: DuplicateBookmarkAction,
  targetBookmarkId?: string,
): Promise<void> {
  switch (action) {
    case 'keep_new':
      return;
    case 'delete_new':
      if (await bookmarkExists(bookmarkId)) {
        await browser.bookmarks.remove(bookmarkId);
      }
      return;
    case 'move_new_to_existing_folder': {
      if (!targetBookmarkId) return;
      const [target] = await browser.bookmarks.get(targetBookmarkId);
      if (!target?.parentId) return;
      await browser.bookmarks.move(bookmarkId, { parentId: target.parentId });
      return;
    }
    case 'open_existing':
      if (!targetBookmarkId) return;
      await openBookmarkById(targetBookmarkId);
      return;
  }
}

async function openBookmarkById(bookmarkId: string): Promise<void> {
  const [bookmark] = await browser.bookmarks.get(bookmarkId);
  if (!bookmark?.url) return;
  await browser.tabs.create({ url: bookmark.url });
}
