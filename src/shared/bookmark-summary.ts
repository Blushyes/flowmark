import type { BookmarkSummaryRecord } from './types';

const STORAGE_KEY = 'flowmark.bookmarkSummaries';

type BookmarkSummaryStore = Record<string, BookmarkSummaryRecord>;

export async function getBookmarkSummary(bookmarkId: string): Promise<BookmarkSummaryRecord | null> {
  const store = await getSummaryStore();
  return store[bookmarkId] ?? null;
}

export async function getBookmarkSummaryByNormalizedUrl(url: string): Promise<BookmarkSummaryRecord | null> {
  const normalizedUrl = normalizeBookmarkUrl(url);
  if (!normalizedUrl) return null;

  const store = await getSummaryStore();
  const matches = Object.values(store)
    .filter((record) => record.normalizedUrl === normalizedUrl)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return matches[0] ?? null;
}

export async function setBookmarkSummary(record: BookmarkSummaryRecord): Promise<void> {
  const store = await getSummaryStore();
  store[record.bookmarkId] = record;
  await browser.storage.local.set({ [STORAGE_KEY]: store });
}

export async function removeBookmarkSummary(bookmarkId: string): Promise<void> {
  const store = await getSummaryStore();
  if (!(bookmarkId in store)) return;
  delete store[bookmarkId];
  await browser.storage.local.set({ [STORAGE_KEY]: store });
}

export async function listRecentBookmarkSummaries(limit: number): Promise<BookmarkSummaryRecord[]> {
  const store = await getSummaryStore();
  return Object.values(store)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, Math.max(0, Math.trunc(limit)));
}

export function normalizeBookmarkUrl(input: string): string | null {
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

async function getSummaryStore(): Promise<BookmarkSummaryStore> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const store = raw[STORAGE_KEY];
  if (!store || typeof store !== 'object') return {};

  const entries = Object.entries(store).filter((entry): entry is [string, BookmarkSummaryRecord] => {
    const value = entry[1];
    return Boolean(
      value &&
      typeof value === 'object' &&
      typeof value.bookmarkId === 'string' &&
      typeof value.normalizedUrl === 'string' &&
      typeof value.summary === 'string',
    );
  });

  return Object.fromEntries(entries);
}
