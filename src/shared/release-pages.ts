import { createTranslator } from './i18n';
import type { Locale } from './types';

export type ReleasePageKind = 'install' | 'update';
export type ReleasePageAction = 'settings' | 'github' | 'chrome-store';

export interface ReleaseMeta {
  currentVersion: string;
  previousVersion: string;
  autoOpenOnUpdateFrom: string[];
  githubUrl: string;
  chromeWebStoreUrl: string;
}

export interface ReleaseFeatureItem {
  title: string;
  description: string;
}

export interface ReleaseInfoCard {
  title: string;
  body: string;
  action?: {
    label: string;
    target: ReleasePageAction;
  };
}

export interface ReleaseSetupStep {
  title: string;
  body: string;
}

export interface ReleaseSetupFieldHint {
  label: string;
  value: string;
  description: string;
}

export interface ReleasePageContent {
  documentTitle: string;
  brandTagline: string;
  eyebrow: string;
  headline: string;
  description: string;
  badges: string[];
  primaryActionLabel: string;
  secondaryActionLabel: string;
  versionSectionTitle: string;
  versionItems: Array<{ label: string; value: string }>;
  featureSectionTitle: string;
  featureSectionDescription: string;
  features: ReleaseFeatureItem[];
  infoCards: ReleaseInfoCard[];
  setupSectionTitle?: string;
  setupSectionDescription?: string;
  setupSteps?: ReleaseSetupStep[];
  setupFieldHints?: ReleaseSetupFieldHint[];
  setupSaveNotesTitle?: string;
  setupSaveNotes?: string[];
}

export const RELEASE_META: ReleaseMeta = {
  currentVersion: '0.1.0',
  previousVersion: '0.0.8',
  autoOpenOnUpdateFrom: ['0.0.8'],
  githubUrl: 'https://github.com/Blushyes/flowmark',
  chromeWebStoreUrl:
    'https://chromewebstore.google.com/detail/kbmjedeepcglnmllaklecppgijhgggdg?utm_source=item-share-cb',
};

export function shouldAutoOpenUpdatePage(
  currentVersion: string,
  previousVersion?: string,
): boolean {
  if (currentVersion !== RELEASE_META.currentVersion) return false;
  if (!previousVersion) return false;
  return RELEASE_META.autoOpenOnUpdateFrom.includes(previousVersion);
}

export function getReleasePageContent(
  locale: Locale,
  pageKind: ReleasePageKind,
): ReleasePageContent {
  const { t } = createTranslator(locale);

  const sharedFeatures: ReleaseFeatureItem[] = [
    {
      title: t('release.featureRecommendationTitle'),
      description: t('release.featureRecommendationDescription'),
    },
    {
      title: t('release.featureDuplicateTitle'),
      description: t('release.featureDuplicateDescription'),
    },
    {
      title: t('release.featureQualityTitle'),
      description: t('release.featureQualityDescription'),
    },
    {
      title: t('release.featureSummaryTitle'),
      description: t('release.featureSummaryDescription'),
    },
    {
      title: t('release.featureI18nTitle'),
      description: t('release.featureI18nDescription'),
    },
  ];

  if (pageKind === 'install') {
    return {
      documentTitle: t('install.documentTitle'),
      brandTagline: t('release.brandTagline'),
      eyebrow: t('install.eyebrow'),
      headline: t('install.headline'),
      description: t('install.description'),
      badges: [t('release.openSourceBadge'), RELEASE_META.currentVersion],
      primaryActionLabel: t('release.openSettings'),
      secondaryActionLabel: t('release.viewGithub'),
      versionSectionTitle: t('release.versionSectionTitle'),
      versionItems: [
        {
          label: t('release.currentVersion'),
          value: RELEASE_META.currentVersion,
        },
      ],
      featureSectionTitle: t('release.featureSectionTitle'),
      featureSectionDescription: t('release.featureSectionDescription', {
        version: RELEASE_META.currentVersion,
      }),
      features: sharedFeatures,
      setupSectionTitle: t('install.setupSectionTitle'),
      setupSectionDescription: t('install.setupSectionDescription'),
      setupSteps: [
        {
          title: t('install.setupStepOpenTitle'),
          body: t('install.setupStepOpenDescription'),
        },
        {
          title: t('install.setupStepFillTitle'),
          body: t('install.setupStepFillDescription'),
        },
        {
          title: t('install.setupStepSaveTitle'),
          body: t('install.setupStepSaveDescription'),
        },
      ],
      setupFieldHints: [
        {
          label: t('options.baseUrlLabel'),
          value: t('options.baseUrlPlaceholder'),
          description: t('install.baseUrlHintDescription'),
        },
        {
          label: t('options.modelLabel'),
          value: t('options.modelPlaceholder'),
          description: t('install.modelHintDescription'),
        },
        {
          label: t('options.apiKeyLabel'),
          value: t('options.apiKeyPlaceholder'),
          description: t('install.apiKeyHintDescription'),
        },
      ],
      setupSaveNotesTitle: t('install.afterSaveTitle'),
      setupSaveNotes: [
        t('install.saveNoteLocalStorage'),
        t('install.saveNotePermission'),
        t('install.saveNoteActivation'),
      ],
      infoCards: [
        {
          title: t('install.openSourceTitle'),
          body: t('install.openSourceDescription'),
          action: {
            label: t('release.viewGithub'),
            target: 'github',
          },
        },
        {
          title: t('install.nextStepTitle'),
          body: t('install.nextStepDescription'),
          action: {
            label: t('release.openSettings'),
            target: 'settings',
          },
        },
      ],
    };
  }

  return {
    documentTitle: t('update.documentTitle', {
      version: RELEASE_META.currentVersion,
    }),
    brandTagline: t('release.brandTagline'),
    eyebrow: t('update.eyebrow'),
    headline: t('update.headline', {
      version: RELEASE_META.currentVersion,
    }),
    description: t('update.description', {
      version: RELEASE_META.currentVersion,
    }),
    badges: [
      t('release.openSourceBadge'),
      t('release.versionTransition', {
        previousVersion: RELEASE_META.previousVersion,
        currentVersion: RELEASE_META.currentVersion,
      }),
    ],
    primaryActionLabel: t('release.openSettings'),
    secondaryActionLabel: t('release.viewGithub'),
    versionSectionTitle: t('release.versionSectionTitle'),
    versionItems: [
      {
        label: t('release.currentVersion'),
        value: RELEASE_META.currentVersion,
      },
      {
        label: t('release.previousVersion'),
        value: RELEASE_META.previousVersion,
      },
    ],
    featureSectionTitle: t('update.featureSectionTitle', {
      version: RELEASE_META.currentVersion,
    }),
    featureSectionDescription: t('update.featureSectionDescription'),
    features: sharedFeatures,
    infoCards: [
      {
        title: t('update.openSourceTitle'),
        body: t('update.openSourceDescription', {
          version: RELEASE_META.currentVersion,
        }),
        action: {
          label: t('release.viewGithub'),
          target: 'github',
        },
      },
      {
        title: t('update.storeTitle'),
        body: t('update.storeDescription'),
        action: {
          label: t('release.openChromeStore'),
          target: 'chrome-store',
        },
      },
    ],
  };
}
