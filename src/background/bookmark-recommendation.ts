import {
  getBookmarkSummary,
  normalizeBookmarkUrl,
  removeBookmarkSummary,
  setBookmarkSummary,
} from '@/src/shared/bookmark-summary';
import { createTranslator, getCurrentLocale } from '@/src/shared/i18n';
import { messaging } from '@/src/shared/messaging';
import { openSettingsPage } from '@/src/shared/open-settings-page';
import { getResolvedSettings } from '@/src/shared/settings';
import type {
  BookmarkActionServices,
  BookmarkCardUpdatePayload,
  BookmarkDecisionCard,
  BookmarkEvaluationContext,
  BookmarkPolicy,
  BookmarkPolicyActionResult,
  BookmarkSummaryRecord,
  BookmarkTreeNodeSnapshot,
  PageContent,
  PolicyResult,
} from '@/src/shared/types';

import {
  buildEvaluationSignals,
  getBookmarksBarId,
  getRelativeFolderPath,
} from './engine/helpers';
import { BookmarkEvaluationStore, type BookmarkJob } from './engine/store';
import { duplicatePolicy } from './policies/duplicate-policy';
import { pageQualityPolicy } from './policies/page-quality-policy';
import { recommendationPolicy } from './policies/recommendation-policy';

const PENDING_CONFIRM_DELAY_MS = 1500;
const QUALITY_PAGE_TEXT_CHARS = 3000;

const policyList = [duplicatePolicy, pageQualityPolicy, recommendationPolicy] as const;
const policyRegistry = new Map<string, BookmarkPolicy>(policyList.map((policy) => [policy.id, policy]));

export function initBookmarkRecommendation(): void {
  const store = new BookmarkEvaluationStore();

  const services: BookmarkActionServices = {
    store,
    continueEvaluation(bookmarkId) {
      store.setActiveCard(bookmarkId);
      store.setState(bookmarkId, 'continuing_after_decision');
      store.enqueue(bookmarkId);
      void drainQueue();
    },
    bookmarkExists,
    async removeBookmark(bookmarkId) {
      await browser.bookmarks.remove(bookmarkId);
    },
    async moveBookmark(bookmarkId, parentId) {
      await browser.bookmarks.move(bookmarkId, { parentId });
    },
    async updateBookmarkTitle(bookmarkId, title) {
      const updated = await browser.bookmarks.update(bookmarkId, { title });
      return {
        id: updated.id,
        title: updated.title,
        url: updated.url,
      };
    },
    async getBookmark(bookmarkId) {
      const [bookmark] = await browser.bookmarks.get(bookmarkId);
      if (!bookmark) return null;
      return {
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        parentId: bookmark.parentId,
      };
    },
    getBookmarksBarId: getBookmarksBarIdFromBrowser,
    getBookmarksBarLabel,
    findOrCreateFolderPath,
    openBookmarkById,
    getResolvedSettings,
    upsertBookmarkSummary,
  };

  browser.bookmarks.onCreated.addListener(async (id, node) => {
    if (!node.url) return;

    const settings = await getResolvedSettings();
    if (!settings.features.recommendation.enabled) return;
    if (store.isSuppressed(id)) return;

    const tabId = await getActiveTabId();
    if (tabId == null) return;

    store.setJob({
      bookmarkId: id,
      url: node.url,
      originalTitle: node.title ?? '',
      tabId,
      pageContentPromise: fetchPageContent(tabId, settings.raw, node.url),
      state: 'pending_confirmation',
    });

    setTimeout(() => {
      store.enqueue(id);
      void drainQueue();
    }, PENDING_CONFIRM_DELAY_MS);
  });

  browser.bookmarks.onRemoved.addListener((bookmarkId) => {
    store.removeJob(bookmarkId);
    void removeBookmarkSummary(bookmarkId);
  });

  browser.bookmarks.onChanged.addListener((bookmarkId) => {
    void syncBookmarkSummaryRecord(bookmarkId);
  });

  browser.bookmarks.onMoved.addListener((bookmarkId) => {
    void syncBookmarkSummaryRecord(bookmarkId);
  });

  messaging.onMessage('submitBookmarkCardAction', async ({ data }) => {
    const card = store.getActiveCard(data.bookmarkId);
    if (!card || card.id !== data.cardId) return;

    const policy = policyRegistry.get(card.policyId);
    if (!policy) return;

    const context = store.getContext(data.bookmarkId);
    if (!context) return;

    const result = await policy.executeAction({
      context,
      card,
      actionId: data.actionId,
      payload: data.payload,
      services,
    });
    handleActionResult(data.bookmarkId, result);
  });

  messaging.onMessage('openOptions', async () => {
    await openSettingsPage();
  });

  async function drainQueue(): Promise<void> {
    if (!store.startDraining()) return;

    try {
      while (store.queue.length > 0) {
        const bookmarkId = store.dequeue();
        if (!bookmarkId) continue;

        const job = store.getJob(bookmarkId);
        if (!job) continue;

        if (!(await bookmarkExists(bookmarkId))) {
          store.removeJob(bookmarkId);
          continue;
        }

        const context = await ensureContext(job);
        if (!context) {
          store.removeJob(bookmarkId);
          continue;
        }

        if (!context.settings.features.recommendation.enabled || store.isSuppressed(bookmarkId)) {
          store.removeJob(bookmarkId);
          continue;
        }

        const startIndex = job.continuation?.nextPolicyIndex ?? 0;
        store.setState(bookmarkId, startIndex > 0 ? 'continuing_after_decision' : 'evaluating');
        store.setActiveCard(bookmarkId);
        store.setContinuation(bookmarkId);

        let stopped = false;
        for (let policyIndex = startIndex; policyIndex < policyList.length; policyIndex += 1) {
          const policy = policyList[policyIndex];
          if (!policy.enabled(context)) continue;

          const progressCard = policy.getProgressCard?.(context) ?? null;
          if (progressCard) {
            store.setActiveCard(bookmarkId, progressCard);
            await sendCardUpdate(job.tabId, progressCard);
          }

          const result = await policy.evaluate(context);
          if (await handlePolicyResult(job, policyIndex, result)) {
            stopped = true;
            break;
          }
        }

        if (!stopped) {
          store.setState(bookmarkId, 'completed');
          store.removeJob(bookmarkId);
        }
      }
    } finally {
      store.finishDraining();
    }
  }

  async function ensureContext(job: BookmarkJob): Promise<BookmarkEvaluationContext | null> {
    if (job.context) return job.context;

    const settings = await getResolvedSettings();
    const locale = await getCurrentLocale(settings.raw);
    const pageContent = await job.pageContentPromise;
    const bookmarkTreeSnapshot = await getBookmarkTreeSnapshot();
    const bookmarksBarId = getBookmarksBarId(bookmarkTreeSnapshot);
    if (!pageContent.url) return null;

    const context: BookmarkEvaluationContext = {
      bookmarkId: job.bookmarkId,
      url: job.url,
      originalTitle: job.originalTitle,
      tabId: job.tabId,
      locale,
      settings,
      pageContent,
      signals: buildEvaluationSignals(job.url, pageContent),
      bookmarksBarId,
      bookmarkTreeSnapshot,
    };

    store.setContext(job.bookmarkId, context);
    return context;
  }

  async function handlePolicyResult(
    job: BookmarkJob,
    policyIndex: number,
    result: PolicyResult,
  ): Promise<boolean> {
    if (result.type === 'pass') return false;
    if (result.type === 'terminal') {
      store.setState(job.bookmarkId, result.reason === 'completed' ? 'completed' : 'dismissed');
      store.removeJob(job.bookmarkId);
      return true;
    }

    const continuation = result.continuation ?? inferContinuation(result.card.policyId, policyIndex);
    store.setActiveCard(job.bookmarkId, result.card);
    store.setContinuation(job.bookmarkId, continuation);
    store.setState(job.bookmarkId, 'waiting_user_decision');
    await sendCardUpdate(job.tabId, result.card);
    return true;
  }

  function handleActionResult(bookmarkId: string, result: BookmarkPolicyActionResult): void {
    switch (result.type) {
      case 'completed':
        store.setActiveCard(bookmarkId);
        store.setState(bookmarkId, 'completed');
        return;
      case 'dismissed':
        store.setActiveCard(bookmarkId);
        store.setState(bookmarkId, 'dismissed');
        return;
      case 'continue':
      case 'noop':
        return;
    }
  }
}

async function sendCardUpdate(tabId: number, card: BookmarkDecisionCard): Promise<void> {
  try {
    const payload: BookmarkCardUpdatePayload = { card };
    await messaging.sendMessage('bookmarkCardUpdate', payload, tabId);
  } catch {
    // Ignore tabs without mounted content UI.
  }
}

function inferContinuation(policyId: string, policyIndex: number) {
  if (policyId === 'page-quality-policy') {
    return { nextPolicyIndex: policyIndex + 1 };
  }
  return undefined;
}

async function fetchPageContent(
  tabId: number,
  settings: { sendPageText: boolean; pageQualityFilterEnabled: boolean; maxPageChars: number },
  url: string,
): Promise<PageContent> {
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

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function bookmarkExists(bookmarkId: string): Promise<boolean> {
  try {
    const nodes = await browser.bookmarks.get(bookmarkId);
    return nodes.length > 0;
  } catch {
    return false;
  }
}

async function getBookmarkTreeSnapshot(): Promise<BookmarkTreeNodeSnapshot[]> {
  return await browser.bookmarks.getTree();
}

async function getBookmarksBarIdFromBrowser(): Promise<string | null> {
  return getBookmarksBarId(await getBookmarkTreeSnapshot());
}

async function getBookmarksBarLabel(settings?: Parameters<typeof getCurrentLocale>[0]): Promise<string> {
  const locale = await getCurrentLocale(settings);
  return createTranslator(locale).t('common.bookmarksBar');
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

    const settings = await getResolvedSettings();
    const tree = await getBookmarkTreeSnapshot();
    const folderPath = getRelativeFolderPath(
      tree,
      getBookmarksBarId(tree),
      bookmark.parentId ?? null,
      await getBookmarksBarLabel(settings.raw),
    );
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
