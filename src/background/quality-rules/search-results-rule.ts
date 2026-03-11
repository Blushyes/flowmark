import type { BookmarkEvaluationContext } from '@/src/shared/types';
import type { PageQualityRule } from './login-page-rule';

const searchTitlePattern = /search results|results for|搜索结果|为你找到|搜尋結果/;
const searchPathPattern = /\/(search|results?)\b/;
const commonSearchParams = new Set(['q', 'query', 'search', 'keyword', 'wd']);

export const searchResultsRule: PageQualityRule = {
  id: 'search-results-rule',
  evaluate(context) {
    const parsedUrl = parseUrlSafely(context.url);
    const hits: string[] = [];

    if (parsedUrl && searchPathPattern.test(parsedUrl.pathname.toLowerCase())) {
      hits.push('search_path');
    }
    if (context.signals.searchParamKeys.some((key) => commonSearchParams.has(key))) {
      hits.push('search_param');
    }
    if (searchTitlePattern.test(context.signals.normalizedTitle)) {
      hits.push('title');
    }
    if (searchTitlePattern.test(context.signals.normalizedHeadings)) {
      hits.push('headings');
    }
    if (context.signals.linkCount >= 12 && context.pageContent.headings.length <= 2 && context.signals.textLength < 2600) {
      hits.push('listing_layout');
    }

    const hasSearchLocation = hits.includes('search_path') || hits.includes('search_param');
    const hasSearchSemantics = hits.includes('title') || hits.includes('headings') || hits.includes('listing_layout');
    if (!hasSearchLocation || !hasSearchSemantics) return null;

    return {
      ruleId: 'search-results-rule',
      reason: 'search_results',
      confidence: hits.includes('title') || hits.includes('headings') ? 0.9 : 0.7,
      signals: hits,
    };
  },
};

function parseUrlSafely(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}
