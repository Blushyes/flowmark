import type { Accessor } from 'solid-js';

import { getSettings, setSettings } from './settings';
import type { FlowmarkSettings, Locale, LocaleOverride } from './types';

type TranslationParam = string | number | boolean | null | undefined;
type TranslationParams = Record<string, TranslationParam>;
type TranslationValue = string | ((params: TranslationParams) => string);

function defineMessages<T extends Record<string, TranslationValue>>(messages: T): T {
  return messages;
}

const enMessages = defineMessages({
  'common.auto': 'Auto',
  'common.english': 'English',
  'common.chineseSimplified': 'Simplified Chinese',
  'common.bookmark': 'Bookmark',
  'common.bookmarksBar': '(Bookmarks Bar)',
  'common.untitled': '(untitled)',
  'common.saving': 'Saving...',
  'common.loading': 'Loading...',
  'common.invalid': 'Invalid',
  'common.settings': 'Settings',
  'common.enable': 'Enable',
  'common.pause': 'Pause',
  'common.saved': 'Saved.',
  'common.onWithChars': ({ count }) => `On · ${count} chars`,
  'common.off': 'Off',
  'common.unknown': 'unknown',
  'common.granted': 'granted',
  'common.notGranted': 'not granted',

  'popup.documentTitle': 'Flowmark',
  'popup.tagline': 'Smart bookmark routing, right after save',
  'popup.recommendation': 'Recommendation',
  'popup.enabled': 'Enabled',
  'popup.paused': 'Paused',
  'popup.autoAccept': ({ seconds }) => `Auto accept ${seconds}s`,
  'popup.aiEndpoint': 'AI endpoint',
  'popup.model': 'Model',
  'popup.permission': 'Permission',
  'popup.pageText': 'Page text',
  'popup.notConfigured': 'Not configured',
  'popup.openFullSettings': 'Open full settings',
  'popup.statusReady': 'Ready',
  'popup.statusSetupNeeded': 'Setup needed',
  'popup.statusPermissionMissing': 'Permission missing',
  'popup.toggleRecommendation': 'Toggle recommendation',

  'options.documentTitle': 'FlowMark Settings',
  'options.headingTitle': 'FlowMark Settings',
  'options.headingDescription': 'Configure your AI provider, recommendation behavior, and auto-accept flow.',
  'options.languageLabel': 'Language',
  'options.languageDescription': 'Follow browser language by default, or force English / Simplified Chinese.',
  'options.recommendationTitle': 'Recommendation',
  'options.recommendationDescription': 'Tune when FlowMark suggests, auto-applies, and sends page content.',
  'options.enableRecommendationLabel': 'Enable smart recommendation',
  'options.enableRecommendationDescription': 'Show a suggestion pill after saving a bookmark.',
  'options.autoAcceptLabel': 'Auto-accept',
  'options.autoAcceptDescription': 'Automatically move or rename after a countdown.',
  'options.autoAcceptSecondsLabel': 'Auto-accept seconds',
  'options.autoAcceptSecondsDescription': '0-60 seconds',
  'options.sendPageTextLabel': 'Send page text to AI',
  'options.sendPageTextDescription': 'Off by default. When on, page text is truncated before sending.',
  'options.maxPageCharsLabel': 'Max page chars',
  'options.maxPageCharsDescription': '500-50,000 characters',
  'options.aiProviderTitle': 'AI Provider',
  'options.aiProviderDescription': 'Use any OpenAI-compatible endpoint. Host permission is requested on save.',
  'options.baseUrlLabel': 'Base URL (normalized to /v1)',
  'options.baseUrlPlaceholder': 'https://api.openai.com/v1',
  'options.permissionLabel': 'Permission',
  'options.modelLabel': 'Model',
  'options.modelPlaceholder': 'gpt-4o-mini',
  'options.apiKeyLabel': 'API Key (optional)',
  'options.apiKeyPlaceholder': 'sk-...',
  'options.saveSettings': 'Save settings',
  'options.statusReady': 'Ready',
  'options.statusSetupNeeded': 'Setup needed',
  'options.statusPermissionMissing': 'Permission missing',
  'options.saveFailed': 'Failed to save settings.',
  'options.permissionDeniedDisabled': 'Host permission was denied. Recommendation has been disabled.',

  'content.smartRecommendation': 'Smart recommendation...',
  'content.tryBookmarkingAgain': 'Try bookmarking again',
  'content.openSettings': 'Settings',
  'content.accept': 'Accept',
  'content.reject': 'Reject',

  'background.aiNotConfigured': 'AI is not configured. Open settings to set base URL and model.',
  'background.hostPermissionNotGranted': 'Host permission not granted for the configured AI base URL.',
  'background.invalidAiBaseUrl': 'Invalid AI base URL.',
  'background.failedRecommendation': 'Failed to get AI recommendation.',
});

type MessageKey = keyof typeof enMessages;
type MessageDictionary = { [K in MessageKey]: TranslationValue };

const zhCNMessages: MessageDictionary = {
  'common.auto': '跟随系统',
  'common.english': 'English',
  'common.chineseSimplified': '简体中文',
  'common.bookmark': '书签',
  'common.bookmarksBar': '（书签栏）',
  'common.untitled': '（未命名）',
  'common.saving': '保存中...',
  'common.loading': '加载中...',
  'common.invalid': '无效',
  'common.settings': '设置',
  'common.enable': '启用',
  'common.pause': '暂停',
  'common.saved': '已保存。',
  'common.onWithChars': ({ count }) => `开启 · ${count} 字符`,
  'common.off': '关闭',
  'common.unknown': '未知',
  'common.granted': '已授权',
  'common.notGranted': '未授权',

  'popup.documentTitle': 'Flowmark',
  'popup.tagline': '收藏后立即智能推荐归档',
  'popup.recommendation': '推荐',
  'popup.enabled': '已启用',
  'popup.paused': '已暂停',
  'popup.autoAccept': ({ seconds }) => `${seconds} 秒后自动接受`,
  'popup.aiEndpoint': 'AI 地址',
  'popup.model': '模型',
  'popup.permission': '权限',
  'popup.pageText': '页面正文',
  'popup.notConfigured': '未配置',
  'popup.openFullSettings': '打开完整设置',
  'popup.statusReady': '已就绪',
  'popup.statusSetupNeeded': '需要配置',
  'popup.statusPermissionMissing': '缺少权限',
  'popup.toggleRecommendation': '切换推荐状态',

  'options.documentTitle': 'FlowMark 设置',
  'options.headingTitle': 'FlowMark 设置',
  'options.headingDescription': '配置 AI 提供方、推荐行为以及自动接受流程。',
  'options.languageLabel': '语言',
  'options.languageDescription': '默认跟随浏览器语言，也可以手动固定为英文或简体中文。',
  'options.recommendationTitle': '推荐',
  'options.recommendationDescription': '控制 FlowMark 何时推荐、自动应用，以及是否发送页面正文。',
  'options.enableRecommendationLabel': '启用智能推荐',
  'options.enableRecommendationDescription': '收藏后显示推荐提示条。',
  'options.autoAcceptLabel': '自动接受',
  'options.autoAcceptDescription': '倒计时结束后自动移动或重命名。',
  'options.autoAcceptSecondsLabel': '自动接受秒数',
  'options.autoAcceptSecondsDescription': '0-60 秒',
  'options.sendPageTextLabel': '发送页面正文给 AI',
  'options.sendPageTextDescription': '默认关闭。开启后会截断正文再发送。',
  'options.maxPageCharsLabel': '页面最大字符数',
  'options.maxPageCharsDescription': '500-50,000 字符',
  'options.aiProviderTitle': 'AI 提供方',
  'options.aiProviderDescription': '支持任意 OpenAI-compatible 接口。保存时会请求对应 host 权限。',
  'options.baseUrlLabel': 'Base URL（会规范化为 /v1）',
  'options.baseUrlPlaceholder': 'https://api.openai.com/v1',
  'options.permissionLabel': '权限',
  'options.modelLabel': '模型',
  'options.modelPlaceholder': 'gpt-4o-mini',
  'options.apiKeyLabel': 'API Key（可选）',
  'options.apiKeyPlaceholder': 'sk-...',
  'options.saveSettings': '保存设置',
  'options.statusReady': '已就绪',
  'options.statusSetupNeeded': '需要配置',
  'options.statusPermissionMissing': '缺少权限',
  'options.saveFailed': '保存设置失败。',
  'options.permissionDeniedDisabled': 'Host 权限被拒绝，推荐功能已自动关闭。',

  'content.smartRecommendation': '智能推荐中...',
  'content.tryBookmarkingAgain': '请重新收藏一次',
  'content.openSettings': '设置',
  'content.accept': '接受',
  'content.reject': '拒绝',

  'background.aiNotConfigured': 'AI 尚未配置。请打开设置填写 Base URL 和模型。',
  'background.hostPermissionNotGranted': '当前 AI Base URL 对应的 host 权限尚未授权。',
  'background.invalidAiBaseUrl': 'AI Base URL 无效。',
  'background.failedRecommendation': '获取 AI 推荐失败。',
};

const messageCatalog: Record<Locale, MessageDictionary> = {
  en: enMessages,
  'zh-CN': zhCNMessages,
};

export function resolveLocale(localeOverride: LocaleOverride, browserLanguage: string): Locale {
  if (localeOverride === 'en' || localeOverride === 'zh-CN') return localeOverride;
  return browserLanguage.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

export function getBrowserUiLanguage(): string {
  return browser.i18n.getUILanguage();
}

export function t(locale: Locale, key: MessageKey, params: TranslationParams = {}): string {
  const value = messageCatalog[locale][key];
  if (typeof value === 'function') return value(params);
  return value.replace(/\{(\w+)\}/g, (_match, token: string) => String(params[token] ?? ''));
}

export function createTranslator(locale: Locale) {
  return {
    t: (key: MessageKey, params?: TranslationParams) => t(locale, key, params),
  };
}

export function useI18n(locale: Accessor<Locale>) {
  return {
    t: (key: MessageKey, params?: TranslationParams) => t(locale(), key, params),
  };
}

export async function getCurrentLocale(
  settings?: Pick<FlowmarkSettings, 'localeOverride'>,
): Promise<Locale> {
  const currentSettings = settings ?? (await getSettings());
  return resolveLocale(currentSettings.localeOverride, getBrowserUiLanguage());
}

export async function setCurrentLocale(localeOverride: LocaleOverride): Promise<void> {
  await setSettings({ localeOverride });
}
