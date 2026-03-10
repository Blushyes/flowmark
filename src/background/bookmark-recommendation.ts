import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, Output } from 'ai';
import { z } from 'zod';

import { messaging } from '@/src/shared/messaging';
import { openSettingsPage } from '@/src/shared/open-settings-page';
import { getSettings, toOriginPermissionPattern } from '@/src/shared/settings';
import type {
  BookmarkSuggestion,
  BookmarkSuggestionUiConfig,
  BookmarkSuggestionUpdatePayload,
  FlowmarkSettings,
  PageContent,
} from '@/src/shared/types';

type BookmarkTreeNode = {
  id: string;
  title: string;
  url?: string | undefined;
};

type PendingBookmark = {
  bookmarkId: string;
  url: string;
  originalTitle: string;
  tabId: number;
  createdAt: number;
  pageContentPromise: Promise<PageContent>;
};

const PENDING_CONFIRM_DELAY_MS = 1500;
const APPLY_SUPPRESS_TTL_MS = 8000;
const MAX_FOLDER_PATHS = 300;
const MAX_FOLDER_DEPTH = 4;
const MAX_HEADINGS = 8;

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
    // Only handle actual bookmark URLs (ignore folders).
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
      createdAt: Date.now(),
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
    // Best-effort: if the user rejected, suppress reprocessing for a short period.
    suppressUntil.set(data.bookmarkId, Date.now() + 2_000);
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

        const ui = toUiConfig(settings);

        const configError = await getAiConfigError(settings);
        if (configError) {
          void sendUiUpdate(job.tabId, {
            kind: 'error',
            bookmarkId,
            url: job.url,
            title: job.originalTitle || 'Bookmark',
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
          title: job.originalTitle || 'Saving...',
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
        });

        if (!suggestion) {
          void sendUiUpdate(job.tabId, {
            kind: 'error',
            bookmarkId,
            url: job.url,
            title: job.originalTitle || 'Bookmark',
            message: 'Failed to get AI recommendation.',
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
    // If there's no content script in this tab (or it's a restricted URL), silently ignore.
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
    const response = await messaging.sendMessage(
      'getPageContent',
      { includeText: settings.sendPageText, maxChars: settings.maxPageChars },
      tabId,
    );
    return response;
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
    if (!child.url) {
      stack.push({ node: child, path: child.title, depth: 1 });
    }
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

async function getAiConfigError(
  settings: FlowmarkSettings,
): Promise<{ message: string; canOpenOptions: boolean } | null> {
  if (!settings.aiBaseURL || !settings.aiModel) {
    return {
      message: 'AI is not configured. Open settings to set base URL and model.',
      canOpenOptions: true,
    };
  }

  try {
    const originPattern = toOriginPermissionPattern(settings.aiBaseURL);
    const granted = await browser.permissions.contains({ origins: [originPattern] });
    if (!granted) {
      return {
        message: 'Host permission not granted for the configured AI base URL.',
        canOpenOptions: true,
      };
    }
  } catch {
    return {
      message: 'Invalid AI base URL.',
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

    // Prefer structured output when supported.
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
      if (parsed.success) return normalizeSuggestion(parsed.data);
    } catch {
      // Fall back to plain JSON parsing for OpenAI-compatible providers that don't
      // support structured outputs.
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

    return normalizeSuggestion(parsed.data);
  } catch {
    return null;
  }
}

function normalizeSuggestion(value: BookmarkSuggestion): BookmarkSuggestion {
  const folder = value.suggestedFolder
    .split(/[-/]+/g)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .slice(0, 4)
    .join('-');
  const title = value.title.trim().slice(0, 160);
  const confidence = Number.isFinite(value.confidence)
    ? Math.min(1, Math.max(0, value.confidence))
    : 0;

  return {
    suggestedFolder: folder,
    title: title.length > 0 ? title : 'Untitled',
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
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length === 0) return bookmarksBarId;

  let currentParentId = bookmarksBarId;
  for (const part of parts) {
    const children = await browser.bookmarks.getChildren(currentParentId);
    const existing = children.find((c) => !c.url && c.title === part);
    if (existing) {
      currentParentId = existing.id;
      continue;
    }

    const created = await browser.bookmarks.create({
      parentId: currentParentId,
      title: part,
    });
    currentParentId = created.id;
  }

  return currentParentId;
}
