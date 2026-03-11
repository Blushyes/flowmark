import { normalizeBookmarkUrl } from '@/src/shared/bookmark-summary';
import type {
  BookmarkEvaluationSignals,
  BookmarkTreeNodeSnapshot,
  DuplicateBookmarkMatch,
  PageContent,
} from '@/src/shared/types';

const MAX_FOLDER_PATHS = 300;
const MAX_FOLDER_DEPTH = 4;
const MAX_DUPLICATE_MATCHES = 3;

export function buildEvaluationSignals(url: string, pageContent: PageContent): BookmarkEvaluationSignals {
  const parsedUrl = parseUrlSafely(url);
  const normalizedText = normalizeSpace(pageContent.text ?? '').toLowerCase();

  return {
    textLength: normalizeSpace(pageContent.text ?? '').length,
    hasPasswordField: pageContent.hasPasswordField,
    formFieldCount: pageContent.formFieldCount,
    linkCount: pageContent.linkCount,
    searchParamKeys: parsedUrl ? [...parsedUrl.searchParams.keys()].map((key) => key.toLowerCase()) : [],
    normalizedTitle: normalizeSpace(pageContent.title).toLowerCase(),
    normalizedDescription: normalizeSpace(pageContent.description).toLowerCase(),
    normalizedHeadings: normalizeSpace(pageContent.headings.join(' ')).toLowerCase(),
    normalizedText,
  };
}

export function getBookmarksBarId(tree: BookmarkTreeNodeSnapshot[]): string | null {
  return tree[0]?.children?.[0]?.id ?? null;
}

export function collectFolderPaths(
  tree: BookmarkTreeNodeSnapshot[],
  bookmarksBarId: string | null,
): string[] {
  if (!bookmarksBarId) return [];

  const barNode = findNodeById(tree, bookmarksBarId);
  if (!barNode?.children) return [];

  const paths: string[] = [];
  const stack: Array<{ node: BookmarkTreeNodeSnapshot; path: string; depth: number }> = [];

  for (const child of barNode.children) {
    if (!child.url) stack.push({ node: child, path: child.title, depth: 1 });
  }

  while (stack.length > 0 && paths.length < MAX_FOLDER_PATHS) {
    const item = stack.pop();
    if (!item) break;

    paths.push(item.path);
    if (item.depth >= MAX_FOLDER_DEPTH) continue;

    for (const child of item.node.children ?? []) {
      if (child.url) continue;
      const title = trimTitle(child.title);
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

export function detectDuplicateMatches(
  tree: BookmarkTreeNodeSnapshot[],
  bookmarksBarId: string | null,
  bookmarkId: string,
  url: string,
  bookmarksBarLabel: string,
  untitledLabel: string,
): DuplicateBookmarkMatch[] {
  const normalizedTarget = normalizeBookmarkUrl(url);
  if (!normalizedTarget) return [];

  const matches: Array<DuplicateBookmarkMatch & { depth: number }> = [];
  const root = tree[0];

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

export function getRelativeFolderPath(
  tree: BookmarkTreeNodeSnapshot[],
  bookmarksBarId: string | null,
  parentId: string | null | undefined,
  bookmarksBarLabel: string,
): string {
  if (!parentId || !bookmarksBarId || parentId === bookmarksBarId) return bookmarksBarLabel;

  const parts: string[] = [];
  let currentId: string | null = parentId;

  while (currentId && currentId !== bookmarksBarId) {
    const node = findNodeById(tree, currentId);
    if (!node) break;
    const title = trimTitle(node.title);
    if (title) parts.unshift(title);
    currentId = node.parentId ?? null;
  }

  return parts.join('-') || bookmarksBarLabel;
}

export function findNodeById(
  tree: BookmarkTreeNodeSnapshot[],
  id: string,
): BookmarkTreeNodeSnapshot | null {
  const stack = [...tree];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) break;
    if (node.id === id) return node;
    for (const child of node.children ?? []) stack.push(child);
  }
  return null;
}

export function trimTitle(title: string | undefined): string {
  return title?.trim() ?? '';
}

function collectDuplicateMatches(
  node: BookmarkTreeNodeSnapshot,
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

function parseUrlSafely(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
