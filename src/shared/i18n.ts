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
  'popup.duplicateCheck': 'Duplicate check',
  'popup.notConfigured': 'Not configured',
  'popup.openFullSettings': 'Open full settings',
  'popup.githubRepo': 'GitHub',
  'popup.statusReady': 'Ready',
  'popup.statusSetupNeeded': 'Setup needed',
  'popup.statusPermissionMissing': 'Permission missing',
  'popup.toggleRecommendation': 'Toggle recommendation',
  'popup.savedSummary': 'Saved summary',
  'popup.pageQualityFilter': 'Page quality filter',

  'release.openSourceBadge': 'Open source',
  'release.openSettings': 'Open settings',
  'release.viewGithub': 'View GitHub',
  'release.openChromeStore': 'Open Chrome Web Store',
  'release.brandTagline': 'Open-source bookmark workflow',
  'release.currentVersion': 'Current version',
  'release.previousVersion': 'Previous version',
  'release.versionSectionTitle': 'Version',
  'release.versionTransition': '{previousVersion} to {currentVersion}',
  'release.featureSectionTitle': 'Open-source edition',
  'release.featureSectionDescription': 'Included in FlowMark {version}',
  'release.featureRecommendationTitle': 'Smart recommendation',
  'release.featureRecommendationDescription': 'Ask AI for a better folder, title, and confidence right after a bookmark is created.',
  'release.featureDuplicateTitle': 'Duplicate detection',
  'release.featureDuplicateDescription': 'Detect the same normalized URL and offer keep, delete, open existing, or move-here actions.',
  'release.featureQualityTitle': 'Page quality filter',
  'release.featureQualityDescription': 'Warn before AI runs when the page looks like a login page, search results, or low-information content.',
  'release.featureSummaryTitle': 'One-sentence summary',
  'release.featureSummaryDescription': 'Store one local sentence about why the page is worth saving and show it again in the popup.',
  'release.featureI18nTitle': 'English and Simplified Chinese',
  'release.featureI18nDescription': 'UI text and generated summaries follow the current FlowMark language setting.',

  'install.documentTitle': 'FlowMark Installed',
  'install.eyebrow': 'Installed',
  'install.headline': 'FlowMark is now open source',
  'install.description': 'Save a page, review duplicate or page-quality warnings, and let AI suggest a cleaner folder, title, and one-sentence summary.',
  'install.openSourceTitle': 'Source available on GitHub',
  'install.openSourceDescription': 'FlowMark is now maintained in the open. Use the public repository to browse the source, track changes, and contribute.',
  'install.nextStepTitle': 'Next step',
  'install.nextStepDescription': 'Open settings, connect any OpenAI-compatible endpoint, and start routing bookmarks right after save.',

  'update.documentTitle': 'FlowMark {version}',
  'update.eyebrow': 'Updated',
  'update.headline': 'What\'s new in FlowMark {version}',
  'update.description': 'The open-source edition is live and now includes the current recommendation pipeline, duplicate checks, quality warnings, and bookmark summaries.',
  'update.featureSectionTitle': 'What is included in {version}',
  'update.featureSectionDescription': 'This release is the first open-source baseline and ships the current bookmark workflow in public.',
  'update.openSourceTitle': 'FlowMark is now open source',
  'update.openSourceDescription': 'Version {version} is maintained publicly and acts as the new open-source baseline for future releases.',
  'update.storeTitle': 'Chrome Web Store',
  'update.storeDescription': 'The current store listing is still the previous legacy version. This open-source edition will be submitted for review later.',

  'options.documentTitle': 'FlowMark Settings',
  'options.headingTitle': 'FlowMark Settings',
  'options.headingDescription': 'Configure your AI provider, recommendation behavior, and auto-accept flow.',
  'options.languageLabel': 'Language',
  'options.languageDescription': 'Follow browser language by default, or force English / Simplified Chinese.',
  'options.recommendationTitle': 'Recommendation',
  'options.recommendationDescription': 'Tune when FlowMark suggests, auto-applies, and sends page content.',
  'options.enableRecommendationLabel': 'Enable smart recommendation',
  'options.enableRecommendationDescription': 'Show a suggestion pill after saving a bookmark.',
  'options.duplicateCheckLabel': 'Duplicate check',
  'options.duplicateCheckDescription': 'Detect bookmarks with the same normalized URL before asking AI.',
  'options.summaryLabel': 'Bookmark summary',
  'options.summaryDescription': 'Generate one sentence about why this page is worth saving.',
  'options.pageQualityFilterLabel': 'Page quality filter',
  'options.pageQualityFilterDescription': 'Warn after bookmarking login pages, search results, or very low-information pages.',
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
  'content.duplicateDetected': 'Already bookmarked',
  'content.alreadyBookmarked': 'Existing bookmark',
  'content.keepNew': 'Keep',
  'content.deleteNew': 'Delete new',
  'content.openExisting': 'Open existing',
  'content.moveToExistingFolder': 'Move here',
  'content.tryBookmarkingAgain': 'Try bookmarking again',
  'content.openSettings': 'Settings',
  'content.accept': 'Accept',
  'content.reject': 'Reject',
  'content.pageMayNotBeWorthSaving': 'This page may not be worth bookmarking',
  'content.bookmarkArticleInstead': 'Try bookmarking the article page instead',
  'content.loginPageDetected': 'This looks like a login or auth page.',
  'content.searchResultsDetected': 'This page looks like search results instead of a concrete article.',
  'content.lowInfoPageDetected': 'This page has very little readable content.',
  'content.continueAnyway': 'Continue anyway',
  'content.keepAsIs': 'Keep as is',
  'content.deleteBookmark': 'Delete bookmark',

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
  'popup.duplicateCheck': '重复检测',
  'popup.notConfigured': '未配置',
  'popup.openFullSettings': '打开完整设置',
  'popup.githubRepo': 'GitHub',
  'popup.statusReady': '已就绪',
  'popup.statusSetupNeeded': '需要配置',
  'popup.statusPermissionMissing': '缺少权限',
  'popup.toggleRecommendation': '切换推荐状态',
  'popup.savedSummary': '已保存摘要',
  'popup.pageQualityFilter': '页面质量过滤',

  'release.openSourceBadge': '开源版',
  'release.openSettings': '打开设置',
  'release.viewGithub': '查看 GitHub',
  'release.openChromeStore': '打开 Chrome 商店',
  'release.brandTagline': '开源书签工作流',
  'release.currentVersion': '当前版本',
  'release.previousVersion': '上一版本',
  'release.versionSectionTitle': '版本',
  'release.versionTransition': '{previousVersion} 到 {currentVersion}',
  'release.featureSectionTitle': '开源版能力',
  'release.featureSectionDescription': '已包含在 FlowMark {version} 中',
  'release.featureRecommendationTitle': '智能推荐',
  'release.featureRecommendationDescription': '收藏后立即请求 AI 生成更合适的目录、标题和置信度。',
  'release.featureDuplicateTitle': '重复检测',
  'release.featureDuplicateDescription': '识别规范化 URL 相同的书签，并提供保留、删除、打开已有、移到已有目录等动作。',
  'release.featureQualityTitle': '页面质量过滤',
  'release.featureQualityDescription': '在 AI 运行前提醒登录页、搜索结果页和低信息密度页面。',
  'release.featureSummaryTitle': '一句话摘要',
  'release.featureSummaryDescription': '为书签保存一条本地摘要，并在 popup 中再次读取，帮助回忆为什么收藏。',
  'release.featureI18nTitle': '中英双语',
  'release.featureI18nDescription': '界面文案和生成摘要都跟随当前 FlowMark 语言设置。',

  'install.documentTitle': 'FlowMark 已安装',
  'install.eyebrow': '已安装',
  'install.headline': 'FlowMark 现已开源',
  'install.description': '收藏页面后，你可以先看到重复检测或页面质量提醒，再由 AI 推荐更合适的目录、标题和一句话摘要。',
  'install.openSourceTitle': '源码现已公开',
  'install.openSourceDescription': 'FlowMark 现在以开源方式维护。你可以在公开仓库中查看源码、跟踪更新并参与贡献。',
  'install.nextStepTitle': '下一步',
  'install.nextStepDescription': '打开设置，接入任意 OpenAI-compatible 接口，然后开始在收藏后自动整理书签。',

  'update.documentTitle': 'FlowMark {version}',
  'update.eyebrow': '已更新',
  'update.headline': 'FlowMark {version} 更新内容',
  'update.description': '开源版已经上线，当前包含完整的推荐流水线、重复检测、页面质量提醒，以及书签摘要能力。',
  'update.featureSectionTitle': '{version} 已包含的能力',
  'update.featureSectionDescription': '这是首个公开维护的开源基线版本，当前书签工作流已经完整开放。',
  'update.openSourceTitle': 'FlowMark 已开源',
  'update.openSourceDescription': '从 {version} 开始，项目会以公开仓库为基线持续维护，并在后续版本继续演进。',
  'update.storeTitle': 'Chrome 商店',
  'update.storeDescription': '当前 Chrome 商店页面仍然是之前的旧版。这个开源版会在后续重新提交审核。',

  'options.documentTitle': 'FlowMark 设置',
  'options.headingTitle': 'FlowMark 设置',
  'options.headingDescription': '配置 AI 提供方、推荐行为以及自动接受流程。',
  'options.languageLabel': '语言',
  'options.languageDescription': '默认跟随浏览器语言，也可以手动固定为英文或简体中文。',
  'options.recommendationTitle': '推荐',
  'options.recommendationDescription': '控制 FlowMark 何时推荐、自动应用，以及是否发送页面正文。',
  'options.enableRecommendationLabel': '启用智能推荐',
  'options.enableRecommendationDescription': '收藏后显示推荐提示条。',
  'options.duplicateCheckLabel': '重复检测',
  'options.duplicateCheckDescription': '在请求 AI 之前，先检测规范化 URL 相同的书签。',
  'options.summaryLabel': '书签摘要',
  'options.summaryDescription': '额外生成一句话摘要，用来快速回忆这页为什么值得收藏。',
  'options.pageQualityFilterLabel': '页面质量过滤',
  'options.pageQualityFilterDescription': '收藏后优先提醒登录页、搜索结果页和低信息密度页面。',
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
  'content.duplicateDetected': '已收藏过',
  'content.alreadyBookmarked': '已有书签',
  'content.keepNew': '保留',
  'content.deleteNew': '删除新的',
  'content.openExisting': '打开已有',
  'content.moveToExistingFolder': '移到这里',
  'content.tryBookmarkingAgain': '请重新收藏一次',
  'content.openSettings': '设置',
  'content.accept': '接受',
  'content.reject': '拒绝',
  'content.pageMayNotBeWorthSaving': '这个页面可能不值得收藏',
  'content.bookmarkArticleInstead': '建议收藏具体文章页而不是搜索结果页',
  'content.loginPageDetected': '这看起来像一个登录或认证页面。',
  'content.searchResultsDetected': '这页更像搜索结果，而不是具体内容页。',
  'content.lowInfoPageDetected': '这个页面的可读信息很少。',
  'content.continueAnyway': '仍然继续',
  'content.keepAsIs': '保留原样',
  'content.deleteBookmark': '删除书签',

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
