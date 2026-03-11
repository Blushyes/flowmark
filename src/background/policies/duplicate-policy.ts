import { createTranslator } from '@/src/shared/i18n';
import type { BookmarkPolicy, PolicyResult } from '@/src/shared/types';

import { detectDuplicateMatches } from '../engine/helpers';

const DUPLICATE_ACTION_SUPPRESS_TTL_MS = 4000;

export const duplicatePolicy: BookmarkPolicy = {
  id: 'duplicate-policy',
  enabled(context) {
    return context.settings.features.duplicate.enabled;
  },
  async evaluate(context): Promise<PolicyResult> {
    const { t } = createTranslator(context.locale);
    const matches = detectDuplicateMatches(
      context.bookmarkTreeSnapshot,
      context.bookmarksBarId,
      context.bookmarkId,
      context.url,
      t('common.bookmarksBar'),
      t('common.untitled'),
    );
    if (matches.length === 0) return { type: 'pass' };

    const first = matches[0];
    return {
      type: 'card',
      card: {
        id: `duplicate:${context.bookmarkId}`,
        policyId: 'duplicate-policy',
        kind: 'decision',
        bookmarkId: context.bookmarkId,
        url: context.url,
        title: context.originalTitle || context.pageContent.title || t('common.bookmark'),
        headline: t('content.duplicateDetected'),
        body: `${t('content.alreadyBookmarked')}: ${first.title || t('common.untitled')}`,
        meta: [{ value: first.folderPath, tone: 'muted' }],
        actions: [
          {
            id: 'keep_new',
            label: t('content.keepNew'),
            variant: 'secondary',
            intent: 'submit',
          },
          {
            id: 'delete_new',
            label: t('content.deleteNew'),
            variant: 'danger',
            intent: 'submit',
          },
          {
            id: 'open_existing',
            label: t('content.openExisting'),
            variant: 'secondary',
            intent: 'submit',
            payload: { targetBookmarkId: first.id },
          },
          {
            id: 'move_new_to_existing_folder',
            label: t('content.moveToExistingFolder'),
            variant: 'primary',
            intent: 'submit',
            payload: { targetBookmarkId: first.id },
          },
        ],
      },
    };
  },
  async executeAction({ card, actionId, payload, services }) {
    switch (actionId) {
      case 'keep_new':
        services.store.suppress(card.bookmarkId, DUPLICATE_ACTION_SUPPRESS_TTL_MS);
        services.store.removeJob(card.bookmarkId);
        return { type: 'dismissed' };
      case 'delete_new':
        services.store.suppress(card.bookmarkId, DUPLICATE_ACTION_SUPPRESS_TTL_MS);
        services.store.removeJob(card.bookmarkId);
        if (await services.bookmarkExists(card.bookmarkId)) {
          await services.removeBookmark(card.bookmarkId);
        }
        return { type: 'completed' };
      case 'move_new_to_existing_folder': {
        const targetBookmarkId = payload?.targetBookmarkId;
        if (!targetBookmarkId) return { type: 'noop' };
        const target = await services.getBookmark(targetBookmarkId);
        if (!target?.parentId) return { type: 'noop' };
        services.store.suppress(card.bookmarkId, DUPLICATE_ACTION_SUPPRESS_TTL_MS);
        services.store.removeJob(card.bookmarkId);
        await services.moveBookmark(card.bookmarkId, target.parentId);
        return { type: 'completed' };
      }
      case 'open_existing': {
        const targetBookmarkId = payload?.targetBookmarkId;
        if (!targetBookmarkId) return { type: 'noop' };
        services.store.suppress(card.bookmarkId, DUPLICATE_ACTION_SUPPRESS_TTL_MS);
        services.store.removeJob(card.bookmarkId);
        await services.openBookmarkById(targetBookmarkId);
        return { type: 'completed' };
      }
      default:
        return { type: 'noop' };
    }
  },
};
