import type { BookmarkEvaluationContext } from '@/src/shared/types';
import type { PageQualityRule } from './login-page-rule';

export const lowInformationDensityRule: PageQualityRule = {
  id: 'low-information-density-rule',
  evaluate(context) {
    const { signals, pageContent } = context;
    const hits: string[] = [];

    if (signals.textLength < 140) hits.push('short_text');
    if (pageContent.headings.length <= 1) hits.push('few_headings');
    if (signals.normalizedDescription.length < 60) hits.push('thin_description');
    if (signals.linkCount >= 18 && signals.textLength < 500) hits.push('navigation_heavy');
    if (signals.formFieldCount >= 3 && signals.textLength < 500) hits.push('form_heavy');
    if (signals.textLength < 260) hits.push('very_short');

    const sparseText = hits.includes('short_text');
    const weakArticleSignals = hits.includes('few_headings') && hits.includes('thin_description');
    const structureHeavy = hits.includes('navigation_heavy') || hits.includes('form_heavy') || hits.includes('very_short');
    if (!sparseText && !(weakArticleSignals && structureHeavy)) return null;

    return {
      ruleId: 'low-information-density-rule',
      reason: 'low_information_density',
      confidence: hits.includes('very_short') ? 0.85 : 0.68,
      signals: hits,
    };
  },
};
