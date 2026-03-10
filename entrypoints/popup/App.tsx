import { createEffect, createMemo, createSignal, onMount, Show } from 'solid-js';

import { Button } from '@/src/components/Button';
import { StatusBadge } from '@/src/components/StatusBadge';
import {
  getBrowserUiLanguage,
  resolveLocale,
  useI18n,
} from '@/src/shared/i18n';
import { openSettingsPage } from '@/src/shared/open-settings-page';
import { getSettings, setSettings, toOriginPermissionPattern } from '@/src/shared/settings';
import type { FlowmarkSettings } from '@/src/shared/types';

export default function App() {
  const [settings, setLocalSettings] = createSignal<FlowmarkSettings | null>(null);
  const [permissionGranted, setPermissionGranted] = createSignal<boolean | null>(null);

  const currentLocale = createMemo(() =>
    resolveLocale(settings()?.localeOverride ?? 'auto', getBrowserUiLanguage()),
  );
  const { t } = useI18n(currentLocale);

  const originPattern = createMemo(() => {
    const current = settings();
    if (!current?.aiBaseURL) return null;
    try {
      return toOriginPermissionPattern(current.aiBaseURL);
    } catch {
      return null;
    }
  });

  const configStatus = createMemo(() => {
    const current = settings();
    if (!current) {
      return {
        label: t('common.loading'),
        tone: 'neutral' as const,
      };
    }

    if (!current.aiBaseURL || !current.aiModel) {
      return {
        label: t('popup.statusSetupNeeded'),
        tone: 'warning' as const,
      };
    }

    if (permissionGranted() === false) {
      return {
        label: t('popup.statusPermissionMissing'),
        tone: 'warning' as const,
      };
    }

    return {
      label: t('popup.statusReady'),
      tone: 'ready' as const,
    };
  });

  createEffect(() => {
    document.title = t('popup.documentTitle');
  });

  createEffect(() => {
    const pattern = originPattern();
    if (!pattern) {
      setPermissionGranted(null);
      return;
    }

    void (async () => {
      try {
        const granted = await browser.permissions.contains({ origins: [pattern] });
        setPermissionGranted(granted);
      } catch {
        setPermissionGranted(null);
      }
    })();
  });

  onMount(() => {
    void (async () => {
      const current = await getSettings();
      setLocalSettings(current);
    })();
  });

  const openOptions = () => {
    void openSettingsPage();
  };

  const openGithubRepo = () => {
    void browser.tabs.create({ url: 'https://github.com/Blushyes/flowmark' });
  };

  const toggleEnabled = async () => {
    const current = settings();
    if (!current) return;
    const nextEnabled = !current.enabled;
    setLocalSettings({ ...current, enabled: nextEnabled });
    await setSettings({ enabled: nextEnabled });
  };

  return (
    <div class="min-h-screen w-[360px] overflow-hidden bg-slate-50 text-slate-900">
      <div class="flex min-h-screen flex-col px-4 pb-4 pt-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <img src="/icon/32.png" alt="FlowMark" class="h-9 w-9 shrink-0 bg-transparent" />
            <div class="min-w-0">
              <div class="text-[15px] font-semibold tracking-[-0.01em] text-slate-950">FlowMark</div>
              <div class="text-xs text-slate-600">{t('popup.tagline')}</div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              aria-label={t('popup.githubRepo')}
              title={t('popup.githubRepo')}
              class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70"
              onClick={openGithubRepo}
            >
              <GitHubIcon class="h-6 w-6" />
            </button>
            <Button type="button" variant="secondary" size="sm" onClick={openOptions}>
              {t('common.settings')}
            </Button>
          </div>
        </div>

        <div class="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3">
          <div>
            <div class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
              {t('popup.recommendation')}
            </div>
            <div class="mt-1 text-sm font-semibold text-slate-900">
              <Show when={settings()} fallback={t('common.loading')}>
                {(current) => (current().enabled ? t('popup.enabled') : t('popup.paused'))}
              </Show>
            </div>
          </div>

          <button
            type="button"
            aria-label={t('popup.toggleRecommendation')}
            class={[
              'relative inline-flex h-8 w-14 items-center rounded-full transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70',
              settings()?.enabled ? 'bg-teal-500' : 'bg-slate-300',
            ].join(' ')}
            onClick={toggleEnabled}
          >
            <span
              class={[
                'inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200',
                settings()?.enabled ? 'translate-x-7' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
        </div>

        <div class="mt-4 flex items-center gap-2">
          <StatusBadge tone={configStatus().tone} class="px-2.5 py-1 text-[11px]">
            {configStatus().label}
          </StatusBadge>
          <Show when={settings()?.autoAcceptEnabled}>
            <StatusBadge tone="neutral" class="px-2.5 py-1 text-[11px] font-medium">
              {t('popup.autoAccept', { seconds: settings()?.autoAcceptSeconds ?? 0 })}
            </StatusBadge>
          </Show>
        </div>

        <div class="mt-4 flex-1 rounded-[24px] border border-slate-200 bg-white">
          <SectionRow
            label={t('popup.aiEndpoint')}
            value={
              settings()?.aiBaseURL
                ? safeOrigin(settings()?.aiBaseURL ?? '', t('common.invalid'))
                : t('popup.notConfigured')
            }
          />
          <SectionRow
            label={t('popup.model')}
            value={settings()?.aiModel || t('popup.notConfigured')}
          />
          <SectionRow
            label={t('popup.permission')}
            value={permissionLabel(permissionGranted(), t)}
            valueClass={permissionTone(permissionGranted())}
          />
          <SectionRow
            label={t('popup.pageText')}
            value={
              settings()?.sendPageText
                ? t('common.onWithChars', { count: settings()?.maxPageChars ?? 0 })
                : t('common.off')
            }
            last
          />
        </div>

        <div class="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <Button type="button" onClick={openOptions}>
            {t('popup.openFullSettings')}
          </Button>
          <Button type="button" variant="secondary" onClick={toggleEnabled}>
            {settings()?.enabled ? t('common.pause') : t('common.enable')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionRow(props: { label: string; value: string; valueClass?: string; last?: boolean }) {
  return (
    <div
      class={[
        'flex items-center justify-between gap-4 px-4 py-3',
        props.last ? '' : 'border-b border-slate-200/70',
      ].join(' ')}
    >
      <div class="text-xs font-medium text-slate-500">{props.label}</div>
      <div
        class={[
          'max-w-[185px] truncate text-right text-xs font-semibold text-slate-900',
          props.valueClass ?? '',
        ].join(' ')}
      >
        {props.value}
      </div>
    </div>
  );
}

function permissionLabel(
  granted: boolean | null,
  t: (key: 'common.unknown' | 'common.granted' | 'common.notGranted') => string,
): string {
  if (granted == null) return t('common.unknown');
  return granted ? t('common.granted') : t('common.notGranted');
}

function permissionTone(granted: boolean | null): string {
  if (granted == null) return 'text-slate-600';
  return granted ? 'text-teal-700' : 'text-amber-700';
}

function safeOrigin(baseURL: string, invalidLabel: string): string {
  try {
    return new URL(baseURL).origin;
  } catch {
    return invalidLabel;
  }
}

function GitHubIcon(props: { class?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      class={props.class}
    >
      <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.88-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.05A9.33 9.33 0 0 1 12 6.84c.85 0 1.71.12 2.5.35 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.46.1 2.72.64.72 1.03 1.63 1.03 2.75 0 3.94-2.35 4.8-4.58 5.06.36.32.68.95.68 1.91 0 1.38-.01 2.49-.01 2.83 0 .27.18.59.69.49A10.27 10.27 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
    </svg>
  );
}
