import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText, Output } from 'ai';
import { z } from 'zod';

import { createTranslator } from '@/src/shared/i18n';
import { toOriginPermissionPattern } from '@/src/shared/settings';
import type {
  BookmarkPolicy,
  BookmarkSuggestion,
  PolicyResult,
} from '@/src/shared/types';

import { collectFolderPaths } from '../engine/helpers';

const MAX_HEADINGS = 8;

const suggestionSchema = z
  .object({
    suggestedFolder: z.string(),
    title: z.string(),
    confidence: z.number().min(0).max(1),
    summary: z.string(),
  })
  .strict();

export const recommendationPolicy: BookmarkPolicy = {
  id: 'recommendation-policy',
  enabled(context) {
    return context.settings.features.recommendation.enabled;
  },
  getProgressCard(context) {
    const { t } = createTranslator(context.locale);
    return {
      id: `loading:${context.bookmarkId}`,
      policyId: 'recommendation-policy',
      kind: 'info',
      bookmarkId: context.bookmarkId,
      url: context.url,
      title: context.originalTitle || t('common.saving'),
      headline: t('content.smartRecommendation'),
      body: context.originalTitle || context.pageContent.title || t('common.bookmark'),
      actions: [],
    };
  },
  async evaluate(context): Promise<PolicyResult> {
    const { t } = createTranslator(context.locale);
    const configError = await getAiConfigError(context.settings.raw, t);
    if (configError) {
      return {
        type: 'card',
        card: {
          id: `error:${context.bookmarkId}`,
          policyId: 'recommendation-policy',
          kind: 'error',
          bookmarkId: context.bookmarkId,
          url: context.url,
          title: context.originalTitle || t('common.bookmark'),
          headline: configError,
          body: t('content.tryBookmarkingAgain'),
          actions: [
            {
              id: 'open_options',
              label: t('content.openSettings'),
              variant: 'secondary',
              intent: 'open-options',
            },
          ],
          autoDismissMs: 4000,
          autoActionId: 'dismiss_error',
        },
      };
    }

    const folderPaths = collectFolderPaths(context.bookmarkTreeSnapshot, context.bookmarksBarId);
    const suggestion = await getSuggestion(context, folderPaths, t('common.untitled'));
    if (!suggestion) {
      return {
        type: 'card',
        card: {
          id: `error:${context.bookmarkId}`,
          policyId: 'recommendation-policy',
          kind: 'error',
          bookmarkId: context.bookmarkId,
          url: context.url,
          title: context.originalTitle || t('common.bookmark'),
          headline: t('background.failedRecommendation'),
          body: t('content.tryBookmarkingAgain'),
          actions: [],
          autoDismissMs: 4000,
          autoActionId: 'dismiss_error',
        },
      };
    }

    const autoAcceptEnabled = context.settings.raw.autoAcceptEnabled;
    const autoAcceptSeconds = Math.max(0, Math.trunc(context.settings.raw.autoAcceptSeconds));

    return {
      type: 'card',
      card: {
        id: `recommendation:${context.bookmarkId}`,
        policyId: 'recommendation-policy',
        kind: 'recommendation',
        bookmarkId: context.bookmarkId,
        url: context.url,
        title: suggestion.title,
        headline: suggestion.suggestedFolder || t('common.bookmarksBar'),
        body: suggestion.title,
        badge: `${Math.round(suggestion.confidence * 100)}%`,
        actions: [
          {
            id: 'reject',
            label: t('content.reject'),
            variant: 'secondary',
            intent: 'submit',
          },
          {
            id: 'accept',
            label: t('content.accept'),
            variant: 'primary',
            intent: 'submit',
            payload: {
              suggestedFolder: suggestion.suggestedFolder,
              title: suggestion.title,
              summary: suggestion.summary,
            },
          },
        ],
        autoActionId: autoAcceptEnabled && autoAcceptSeconds > 0 ? 'accept' : undefined,
        autoDismissMs: autoAcceptEnabled && autoAcceptSeconds > 0 ? autoAcceptSeconds * 1000 : undefined,
      },
    };
  },
  async executeAction({ card, actionId, payload, services }) {
    switch (actionId) {
      case 'accept': {
        services.store.suppress(card.bookmarkId, 8000);
        services.store.removeJob(card.bookmarkId);

        const bookmarksBarId = await services.getBookmarksBarId();
        if (!bookmarksBarId) return { type: 'noop' };
        const suggestedFolder = payload?.suggestedFolder ?? '';
        const title = payload?.title ?? card.title;
        const summary = payload?.summary ?? '';
        const parentId = await services.findOrCreateFolderPath(bookmarksBarId, suggestedFolder);
        await services.moveBookmark(card.bookmarkId, parentId);
        const updatedBookmark = await services.updateBookmarkTitle(card.bookmarkId, title);

        const settings = await services.getResolvedSettings();
        if (!settings.features.summary.enabled || !updatedBookmark.url || !summary.trim()) {
          return { type: 'completed' };
        }
        await services.upsertBookmarkSummary({
          bookmarkId: updatedBookmark.id,
          url: updatedBookmark.url,
          title: updatedBookmark.title,
          folderPath: suggestedFolder || (await services.getBookmarksBarLabel(settings.raw)),
          summary: summary.trim(),
        });
        return { type: 'completed' };
      }
      case 'reject':
      case 'dismiss_error':
        services.store.suppress(card.bookmarkId, 2000);
        services.store.removeJob(card.bookmarkId);
        return { type: 'dismissed' };
      default:
        return { type: 'noop' };
    }
  },
};

async function getAiConfigError(
  settings: { aiBaseURL: string; aiModel: string },
  t: (key: 'background.aiNotConfigured' | 'background.hostPermissionNotGranted' | 'background.invalidAiBaseUrl') => string,
): Promise<string | null> {
  if (!settings.aiBaseURL || !settings.aiModel) {
    return t('background.aiNotConfigured');
  }

  try {
    const originPattern = toOriginPermissionPattern(settings.aiBaseURL);
    const granted = await browser.permissions.contains({ origins: [originPattern] });
    if (!granted) {
      return t('background.hostPermissionNotGranted');
    }
  } catch {
    return t('background.invalidAiBaseUrl');
  }

  return null;
}

async function getSuggestion(
  context: Parameters<BookmarkPolicy['evaluate']>[0],
  folderPaths: string[],
  untitledFallback: string,
): Promise<BookmarkSuggestion | null> {
  const settings = context.settings.raw;
  const provider = createOpenAICompatible({
    name: 'flowmark',
    baseURL: settings.aiBaseURL,
    apiKey: settings.aiApiKey.trim() || undefined,
  });

  const model = provider.chatModel(settings.aiModel);
  const pageTitle = context.pageContent.title || context.originalTitle;
  const headings = context.pageContent.headings.slice(0, MAX_HEADINGS);
  const outputLanguage = context.locale === 'zh-CN' ? 'Simplified Chinese' : 'English';

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
  promptParts.push(`URL: ${context.url}`);
  if (pageTitle) promptParts.push(`Page title: ${pageTitle}`);
  if (context.pageContent.description) promptParts.push(`Description: ${context.pageContent.description}`);
  if (headings.length > 0) promptParts.push(`Headings: ${headings.join(' | ')}`);
  if (settings.sendPageText && context.pageContent.text) {
    promptParts.push(`Page text (truncated):\n${context.pageContent.text}`);
  }
  promptParts.push('Existing folders (use one of these if possible):');
  promptParts.push(folderPaths.join('\n'));

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
      if (parsed.success) return normalizeSuggestion(parsed.data, untitledFallback, context.settings.features.summary.enabled);
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

    return normalizeSuggestion(parsed.data, untitledFallback, context.settings.features.summary.enabled);
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
