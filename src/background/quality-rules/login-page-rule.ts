import type { BookmarkEvaluationContext, BookmarkPageQualityReason } from '@/src/shared/types';

export interface PageQualityRuleMatch {
  ruleId: string;
  reason: BookmarkPageQualityReason;
  confidence: number;
  signals: string[];
}

export interface PageQualityRule {
  id: string;
  evaluate(context: BookmarkEvaluationContext): PageQualityRuleMatch | null;
}

const loginPattern = /(^|[\W_])(login|signin|sign-in|signup|sign-up|register|auth|account|password|log in|sign in|登录|登入|注册)([\W_]|$)/;

export const loginPageRule: PageQualityRule = {
  id: 'login-page-rule',
  evaluate(context) {
    const { signals, pageContent, url } = context;
    const hits: string[] = [];

    if (signals.hasPasswordField) hits.push('password_field');
    if (loginPattern.test(url.toLowerCase())) hits.push('login_url');
    if (loginPattern.test(signals.normalizedTitle)) hits.push('login_title');
    if (loginPattern.test(signals.normalizedDescription)) hits.push('login_description');
    if (loginPattern.test(signals.normalizedHeadings)) hits.push('login_heading');
    if (signals.formFieldCount >= 2 && /password|登录|signin|sign in/.test(signals.normalizedText)) {
      hits.push('password_text');
    }

    const looksLikeLogin = hits.length > 0;
    if (!looksLikeLogin) return null;
    if (!pageContent.hasPasswordField && signals.textLength >= 1400) return null;

    return {
      ruleId: 'login-page-rule',
      reason: 'login_page',
      confidence: pageContent.hasPasswordField ? 0.95 : 0.72,
      signals: hits,
    };
  },
};
