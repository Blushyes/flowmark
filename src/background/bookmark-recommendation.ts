import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, Output } from 'ai';
import { z } from 'zod';

import {
  getBookmarkSummary,
  normalizeBookmarkUrl,
  removeBookmarkSummary,
  setBookmarkSummary,
} from '@/src/shared/bookmark-summary';
import { createTranslator, getCurrentLocale } from '@/src/shared/i18n';
import { messaging } from '@/src/shared/messaging';
import { openSettingsPage } from '@/src/shared/open-settings-page';
import { getSettings, toOriginPermissionPattern } from '@/src/shared/settings';
import type {
  BookmarkPageQualityReason,
  BookmarkSuggestion,
  BookmarkSuggestionUiConfig,
  BookmarkSuggestionUpdatePayload,
  BookmarkSummaryRecord,
  DuplicateBookmarkAction,
  DuplicateBookmarkMatch,
  FlowmarkSettings,
  Locale,
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

type QualityWarning = {
  reason: BookmarkPageQualityReason;
  message: string;
  detail: string;
};

const PENDING_CONFIRM_DELAY_MS = 1500;
const APPLY_SUPPRESS_TTL_MS = 8000;
const DUPLICATE_ACTION_SUPPRESS_TTL_MS = 4000;
const QUALITY_ACTION_SUPPRESS_TTL_MS = 4000;
const MAX_FOLDER_PATHS = 300;
const MAX_FOLDER_DEPTH = 4;
const MAX_HEADINGS = 8;
const MAX_DUPLICATE_MATCHES = 3;
const QUALITY_PAGE_TEXT_CHARS = 3000;

const suggestionSchema = z
  .object({
    suggestedFolder: z.string(),
    title: z.string(),
    confidence: z.number().min(0).max(1),
    summary: z.string(),
  })
  .strict();

export function initBookmarkRecommendation(): void {
  const pending = new Map<string, PendingBookmark>();
  const queue: string[] = [];
  const suppressUntil = new Map<string, number>();
  const qualityApproved = new Set<string>();

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

  browser.bookmarks.onRemoved.addListener((bookmarkId) => {
    pending.delete(bookmarkId);
    qualityApproved.delete(bookmarkId);
    void removeBookmarkSummary(bookmarkId);
  });

  browser.bookmarks.onChanged.addListener((bookmarkId) => {
    void syncBookmarkSummaryRecord(bookmarkId);
  });

  browser.bookmarks.onMoved.addListener((bookmarkId) => {
    void syncBookmarkSummaryRecord(bookmarkId);
  });

  messaging.onMessage('applyBookmarkSuggestion', async ({ data }) => {
    suppressUntil.set(data.bookmarkId, Date.now() + APPLY_SUPPRESS_TTL_MS);

    const barId = await getBookmarksBarId();
    if (barId == null) return;

    const parentId = await findOrCreateFolderPath(barId, data.suggestedFolder);
    await browser.bookmarks.move(data.bookmarkId, { parentId });
    const updatedBookmark = await browser.bookmarks.update(data.bookmarkId, { title: data.title });

    const settings = await getSettings();
    if (!settings.summaryEnabled || !updatedBookmark.url) return;

    const summary = data.summary.trim();
    if (!summary) return;

    await upsertBookmarkSummary({
      bookmarkId: updatedBookmark.id,
      url: updatedBookmark.url,
      title: updatedBookmark.title,
      folderPath: data.suggestedFolder || (await getBookmarksBarLabel(settings)),
      summary,
    });
  });

  messaging.onMessage('rejectBookmarkSuggestion', ({ data }) => {
    suppressUntil.set(data.bookmarkId, Date.now() + 2_000);
  });

  messaging.onMessage('resolveDuplicateBookmark', async ({ data }) => {
    pending.delete(data.bookmarkId);
    qualityApproved.delete(data.bookmarkId);
    suppressUntil.set(data.bookmarkId, Date.now() + DUPLICATE_ACTION_SUPPRESS_TTL_MS);
    await resolveDuplicateBookmark(data.bookmarkId, data.action, data.targetBookmarkId);
  });

  messaging.onMessage('dismissDuplicateBookmark', ({ data }) => {
    pending.delete(data.bookmarkId);
    qualityApproved.delete(data.bookmarkId);
    suppressUntil.set(data.bookmarkId, Date.now() + DUPLICATE_ACTION_SUPPRESS_TTL_MS);
  });

  messaging.onMessage('continueBookmarkRecommendation', ({ data }) => {
    if (!pending.has(data.bookmarkId)) return;
    qualityApproved.add(data.bookmarkId);
    queue.push(data.bookmarkId);
    void drainQueue();
  });

  messaging.onMessage('dismissBookmarkQualityWarning', ({ data }) => {
    pending.delete(data.bookmarkId);
    qualityApproved.delete(data.bookmarkId);
    suppressUntil.set(data.bookmarkId, Date.now() + QUALITY_ACTION_SUPPRESS_TTL_MS);
  });

  messaging.onMessage('deleteLowQualityBookmark', async ({ data }) => {
    pending.delete(data.bookmarkId);
    qualityApproved.delete(data.bookmarkId);
    suppressUntil.set(data.bookmarkId, Date.now() + QUALITY_ACTION_SUPPRESS_TTL_MS);
    if (await bookmarkExists(data.bookmarkId)) {
      await browser.bookmarks.remove(data.bookmarkId);
    }
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

        const stillExists = await bookmarkExists(bookmarkId);
        if (!stillExists) {
          pending.delete(bookmarkId);
          qualityApproved.delete(bookmarkId);
          continue;
        }

        const settings = await getSettings();
        if (!settings.enabled) {
          pending.delete(bookmarkId);
          qualityApproved.delete(bookmarkId);
          continue;
        }
        if (isSuppressed(bookmarkId, suppressUntil)) {
          pending.delete(bookmarkId);
          qualityApproved.delete(bookmarkId);
          continue;
        }

        const ui = toUiConfig(settings);
        const locale = await getCurrentLocale(settings);
        const { t } = createTranslator(locale);

        if (settings.duplicateCheckEnabled) {
          const duplicates = await detectDuplicateBookmarks(
            bookmarkId,
            job.url,
            t('common.bookmarksBar'),
            t('common.untitled'),
          );
          if (duplicates.length > 0) {
            pending.delete(bookmarkId);
            qualityApproved.delete(bookmarkId);
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

        const pageContent = await job.pageContentPromise;
        const skipQualityWarning = qualityApproved.delete(bookmarkId);
        if (settings.pageQualityFilterEnabled && !skipQualityWarning) {
          const qualityWarning = detectBookmarkPageQuality(job.url, pageContent, t);
          if (qualityWarning) {
            void sendUiUpdate(job.tabId, {
              kind: 'quality-warning',
              bookmarkId,
              url: job.url,
              title: job.originalTitle || pageContent.title || t('common.bookmark'),
              quality: qualityWarning,
              ui,
            });
            continue;
          }
        }

        pending.delete(bookmarkId);

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

        const folderPaths = await collectFolderPaths();
        const suggestion = await getSuggestion(settings, {
          locale,
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
      {
        includeText: settings.sendPageText || settings.pageQualityFilterEnabled,
        maxChars: Math.max(settings.maxPageChars, QUALITY_PAGE_TEXT_CHARS),
      },
      tabId,
    );
  } catch {
    return {
      url,
      title: '',
      description: '',
      headings: [],
      text: null,
      hasPasswordField: false,
      formFieldCount: 0,
      linkCount: 0,
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

async function getBookmarksBarLabel(settings?: FlowmarkSettings): Promise<string> {
  const locale = await getCurrentLocale(settings);
  return createTranslator(locale).t('common.bookmarksBar');
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
        collectDuplicateMatches(
          grandchild,
          [],
          normalizedTarget,
          bookmarkId,
          matches,
          bookmarksBarLabel,
          untitledLabel,
        );
      }
      continue;
    }

    collectDuplicateMatches(
      child,
      [],
      normalizedTarget,
      bookmarkId,
      matches,
      bookmarksBarLabel,
      untitledLabel,
    );
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

function detectBookmarkPageQuality(
  url: string,
  pageContent: PageContent,
  t: (key:
    | 'content.pageMayNotBeWorthSaving'
    | 'content.bookmarkArticleInstead'
    | 'content.loginPageDetected'
    | 'content.searchResultsDetected'
    | 'content.lowInfoPageDetected') => string,
): QualityWarning | null {
  const normalizedUrl = normalizeBookmarkUrl(url) ?? url;
  const lowerUrl = normalizedUrl.toLowerCase();
  const lowerTitle = pageContent.title.toLowerCase();
  const lowerDescription = pageContent.description.toLowerCase();
  const lowerHeadings = pageContent.headings.join(' ').toLowerCase();
  const lowerText = (pageContent.text ?? '').toLowerCase();
  const combinedMeta = `${lowerTitle} ${lowerDescription} ${lowerHeadings}`.trim();
  const textLength = (pageContent.text ?? '').replace(/\s+/g, ' ').trim().length;

  const loginPattern = /(^|[\W_])(login|signin|sign-in|signup|sign-up|register|auth|account|password|log in|sign in|登录|登入|注册)([\W_]|$)/;
  const looksLikeLogin =
    pageContent.hasPasswordField ||
    loginPattern.test(lowerUrl) ||
    loginPattern.test(combinedMeta) ||
    (pageContent.formFieldCount >= 2 && /password|登录|signin|sign in/.test(lowerText));
  if (looksLikeLogin && (pageContent.hasPasswordField || textLength < 1400)) {
    return {
      reason: 'login_page',
      message: t('content.pageMayNotBeWorthSaving'),
      detail: t('content.loginPageDetected'),
    };
  }

  const parsedUrl = parseUrlSafely(url);
  const hasSearchPath = Boolean(parsedUrl && /\/(search|results?)\b/.test(parsedUrl.pathname.toLowerCase()));
  const hasSearchParam = Boolean(
    parsedUrl && ['q', 'query', 'search', 'keyword', 'wd'].some((key) => parsedUrl.searchParams.has(key)),
  );
  const looksLikeSearchTitle = /search results|results for|搜索结果|为你找到|搜尋結果/.test(combinedMeta);
  const searchLikeListing = pageContent.linkCount >= 12 && pageContent.headings.length <= 2 && textLength < 2600;
  if ((hasSearchPath || hasSearchParam) && (looksLikeSearchTitle || searchLikeListing)) {
    return {
      reason: 'search_results',
      message: t('content.bookmarkArticleInstead'),
      detail: t('content.searchResultsDetected'),
    };
  }

  const sparseText = textLength < 140;
  const weakArticleSignals = pageContent.headings.length <= 1 && pageContent.description.trim().length < 60;
  const navigationHeavy = pageContent.linkCount >= 18 && textLength < 500;
  const formHeavy = pageContent.formFieldCount >= 3 && textLength < 500;
  if (sparseText || (weakArticleSignals && (navigationHeavy || formHeavy || textLength < 260))) {
    return {
      reason: 'low_information_density',
      message: t('content.pageMayNotBeWorthSaving'),
      detail: t('content.lowInfoPageDetected'),
    };
  }

  return null;
}

function parseUrlSafely(url: string): URL | null {
  try {
    return new URL(url);
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
    locale: Locale;
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
  const outputLanguage = input.locale === 'zh-CN' ? 'Simplified Chinese' : 'English';

  const system =
    'You are a bookmark organizer. Return a JSON object with a suggested folder path, a short improved title, and a one-sentence summary.' +
    '\nRules:' +
    '\n- suggestedFolder must be a "-" separated relative path (do NOT include the bookmarks bar root name).' +
    '\n- Keep suggestedFolder to at most 4 segments.' +
    '\n- Prefer choosing an existing folder path from the provided list.' +
    '\n- title must be short, readable, and not include extra quotes.' +
    '\n- summary must be exactly one sentence, plain text only, and explain why this page is worth saving or what it is mainly about.' +
    '\n- summary must not repeat the title verbatim.' +
    '\n- confidence must be a number between 0 and 1.' +
    `\n- title and summary must be written in ${outputLanguage}.`;

  const promptParts: string[] = [];
  promptParts.push(`URL: ${input.url}`);
  if (pageTitle) promptParts.push(`Page title: ${pageTitle}`);
  if (input.pageContent.description) promptParts.push(`Description: ${input.pageContent.description}`);
  if (headings.length > 0) promptParts.push(`Headings: ${headings.join(' | ')}`);
  if (settings.sendPageText && input.pageContent.text) {
    promptParts.push(`Page text (truncated):\n${input.pageContent.text}`);
  }
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
        maxOutputTokens: 260,
        output: Output.object({
          schema: suggestionSchema,
        }),
      });

      const parsed = suggestionSchema.safeParse(result.output);
      if (parsed.success) return normalizeSuggestion(parsed.data, input.untitledFallback, settings.summaryEnabled);
    } catch {
      // Fall back to plain JSON parsing for providers without structured outputs.
    }

    const { text } = await generateText({
      model,
      system: `${system}\n\nReturn ONLY valid JSON.`,
      prompt,
      temperature: 0.2,
      maxOutputTokens: 280,
    });

    const json = extractFirstJsonObject(text);
    if (!json) return null;

    const parsed = suggestionSchema.safeParse(json);
    if (!parsed.success) return null;

    return normalizeSuggestion(parsed.data, input.untitledFallback, settings.summaryEnabled);
  } catch {
    return null;
  }
}

function normalizeSuggestion(
  value: BookmarkSuggestion,
  untitledFallback: string,
  summaryEnabled: boolean,
): BookmarkSuggestion {
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
  const summary = summaryEnabled ? normalizeSummary(value.summary, title || untitledFallback) : '';

  return {
    suggestedFolder: folder,
    title: title.length > 0 ? title : untitledFallback,
    confidence,
    summary,
  };
}

function normalizeSummary(summary: string, title: string): string {
  const cleaned = summary
    .replace(/\s+/g, ' ')
    .replace(/^[-*\d.)\s]+/, '')
    .trim()
    .slice(0, 240);

  if (!cleaned) return '';
  if (cleaned.toLowerCase() === title.trim().toLowerCase()) return '';
  if (/[.!?。！？]$/.test(cleaned)) return cleaned;
  return `${cleaned}.`;
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

async function upsertBookmarkSummary(input: {
  bookmarkId: string;
  url: string;
  title: string;
  folderPath: string;
  summary: string;
}): Promise<void> {
  const normalizedUrl = normalizeBookmarkUrl(input.url);
  if (!normalizedUrl) return;

  const existing = await getBookmarkSummary(input.bookmarkId);
  const now = Date.now();
  const record: BookmarkSummaryRecord = {
    bookmarkId: input.bookmarkId,
    url: input.url,
    normalizedUrl,
    title: input.title,
    folderPath: input.folderPath,
    summary: input.summary,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await setBookmarkSummary(record);
}

async function syncBookmarkSummaryRecord(bookmarkId: string): Promise<void> {
  const record = await getBookmarkSummary(bookmarkId);
  if (!record) return;

  try {
    const [bookmark] = await browser.bookmarks.get(bookmarkId);
    if (!bookmark?.url) {
      await removeBookmarkSummary(bookmarkId);
      return;
    }

    const settings = await getSettings();
    const folderPath = await getRelativeFolderPath(bookmark.parentId ?? null, settings);
    await upsertBookmarkSummary({
      bookmarkId,
      url: bookmark.url,
      title: bookmark.title,
      folderPath,
      summary: record.summary,
    });
  } catch {
    await removeBookmarkSummary(bookmarkId);
  }
}

async function getRelativeFolderPath(parentId: string | null, settings?: FlowmarkSettings): Promise<string> {
  const bookmarksBarId = await getBookmarksBarId();
  const bookmarksBarLabel = await getBookmarksBarLabel(settings);
  if (!parentId || !bookmarksBarId || parentId === bookmarksBarId) return bookmarksBarLabel;

  const parts: string[] = [];
  let currentId: string | null = parentId;

  while (currentId && currentId !== bookmarksBarId) {
    const nodes: BookmarkTreeNode[] = await browser.bookmarks.get(currentId);
    const node: BookmarkTreeNode | undefined = nodes[0];
    if (!node) break;
    const title = trimTitle(node.title);
    if (title) parts.unshift(title);
    currentId = node.parentId ?? null;
  }

  return parts.join('-') || bookmarksBarLabel;
}
