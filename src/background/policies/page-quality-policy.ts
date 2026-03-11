import { createTranslator } from '@/src/shared/i18n';
import type {
  BookmarkPageQualityReason,
  BookmarkPolicy,
  PolicyResult,
} from '@/src/shared/types';

import { loginPageRule, type PageQualityRule, type PageQualityRuleMatch } from '../quality-rules/login-page-rule';
import { lowInformationDensityRule } from '../quality-rules/low-information-density-rule';
import { searchResultsRule } from '../quality-rules/search-results-rule';

const QUALITY_ACTION_SUPPRESS_TTL_MS = 4000;

const pageQualityRules: PageQualityRule[] = [
  loginPageRule,
  searchResultsRule,
  lowInformationDensityRule,
];

const reasonPriority: Record<BookmarkPageQualityReason, number> = {
  login_page: 0,
  search_results: 1,
  low_information_density: 2,
};

export const pageQualityPolicy: BookmarkPolicy = {
  id: 'page-quality-policy',
  enabled(context) {
    return context.settings.features.pageQuality.enabled;
  },
  async evaluate(context): Promise<PolicyResult> {
    const matches = pageQualityRules
      .map((rule) => rule.evaluate(context))
      .filter((match): match is PageQualityRuleMatch => match != null)
      .sort((a, b) => {
        const priorityDelta = reasonPriority[a.reason] - reasonPriority[b.reason];
        if (priorityDelta !== 0) return priorityDelta;
        return b.confidence - a.confidence;
      });

    const best = matches[0];
    if (!best) return { type: 'pass' };

    const { t } = createTranslator(context.locale);
    const cardText = toCardText(best.reason, t);

    return {
      type: 'card',
      card: {
        id: `quality:${context.bookmarkId}`,
        policyId: 'page-quality-policy',
        kind: 'warning',
        bookmarkId: context.bookmarkId,
        url: context.url,
        title: context.originalTitle || context.pageContent.title || t('common.bookmark'),
        headline: cardText.headline,
        body: cardText.body,
        actions: [
          {
            id: 'continue',
            label: t('content.continueAnyway'),
            variant: 'primary',
            intent: 'submit',
          },
          {
            id: 'keep_as_is',
            label: t('content.keepAsIs'),
            variant: 'secondary',
            intent: 'submit',
          },
          {
            id: 'delete_bookmark',
            label: t('content.deleteBookmark'),
            variant: 'danger',
            intent: 'submit',
          },
        ],
      },
      continuation: {
        nextPolicyIndex: 2,
      },
    };
  },
  async executeAction({ card, actionId, services }) {
    switch (actionId) {
      case 'continue':
        services.continueEvaluation(card.bookmarkId);
        return { type: 'continue' };
      case 'keep_as_is':
        services.store.suppress(card.bookmarkId, QUALITY_ACTION_SUPPRESS_TTL_MS);
        services.store.removeJob(card.bookmarkId);
        return { type: 'dismissed' };
      case 'delete_bookmark':
        services.store.suppress(card.bookmarkId, QUALITY_ACTION_SUPPRESS_TTL_MS);
        services.store.removeJob(card.bookmarkId);
        if (await services.bookmarkExists(card.bookmarkId)) {
          await services.removeBookmark(card.bookmarkId);
        }
        return { type: 'completed' };
      default:
        return { type: 'noop' };
    }
  },
};

function toCardText(
  reason: BookmarkPageQualityReason,
  t: (key:
    | 'content.pageMayNotBeWorthSaving'
    | 'content.bookmarkArticleInstead'
    | 'content.loginPageDetected'
    | 'content.searchResultsDetected'
    | 'content.lowInfoPageDetected') => string,
) {
  switch (reason) {
    case 'login_page':
      return {
        headline: t('content.pageMayNotBeWorthSaving'),
        body: t('content.loginPageDetected'),
      };
    case 'search_results':
      return {
        headline: t('content.bookmarkArticleInstead'),
        body: t('content.searchResultsDetected'),
      };
    case 'low_information_density':
      return {
        headline: t('content.pageMayNotBeWorthSaving'),
        body: t('content.lowInfoPageDetected'),
      };
  }
}
