import { createEffect, createMemo, createSignal, onMount, Show } from 'solid-js';

import { Button } from '@/src/components/Button';
import { getBrowserUiLanguage, resolveLocale, useI18n } from '@/src/shared/i18n';
import { openSettingsPage } from '@/src/shared/open-settings-page';
import { getBookmarkSummaryByNormalizedUrl } from '@/src/shared/bookmark-summary';
import { getSettings, setSettings } from '@/src/shared/settings';
import type { BookmarkSummaryRecord, FlowmarkSettings } from '@/src/shared/types';

export default function App() {
  const [settings, setLocalSettings] = createSignal<FlowmarkSettings | null>(null);
  const [summaryRecord, setSummaryRecord] = createSignal<BookmarkSummaryRecord | null>(null);

  const currentLocale = createMemo(() =>
    resolveLocale(settings()?.localeOverride ?? 'auto', getBrowserUiLanguage()),
  );
  const { t } = useI18n(currentLocale);

  createEffect(() => {
    document.title = t('popup.documentTitle');
  });

  onMount(() => {
    void (async () => {
      const current = await getSettings();
      setLocalSettings(current);

      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const url = tab?.url;
      if (!url) return;

      const summary = await getBookmarkSummaryByNormalizedUrl(url);
      setSummaryRecord(summary);
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

          <button
            type="button"
            aria-label={t('popup.githubRepo')}
            title={t('popup.githubRepo')}
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70"
            onClick={openGithubRepo}
          >
            <GitHubIcon class="h-6 w-6" />
          </button>
        </div>

        <div class="mt-5 rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                {t('popup.recommendation')}
              </div>
              <div class="mt-2 text-xl font-semibold tracking-[-0.02em] text-slate-950">
                <Show when={settings()} fallback={t('common.loading')}>
                  {(current) => (current().enabled ? t('popup.enabled') : t('popup.paused'))}
                </Show>
              </div>
              <div class="mt-2 max-w-[220px] text-sm leading-6 text-slate-600">
                {t('popup.tagline')}
              </div>
            </div>

            <button
              type="button"
              aria-label={t('popup.toggleRecommendation')}
              class={[
                'relative mt-1 inline-flex h-8 w-14 items-center rounded-full transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70',
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
        </div>

        <Show when={summaryRecord()}>
          {(record) => (
            <div class="mt-3 rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                {t('popup.savedSummary')}
              </div>
              <div class="mt-2 truncate text-sm font-semibold text-slate-900" title={record().title}>
                {record().title}
              </div>
              <div class="mt-2 text-sm leading-6 text-slate-700">
                {record().summary}
              </div>
              <div class="mt-2 truncate text-xs text-slate-500" title={record().folderPath}>
                {record().folderPath}
              </div>
            </div>
          )}
        </Show>

        <div class="mt-auto pt-4">
          <Button type="button" block onClick={openOptions}>
            {t('popup.openFullSettings')}
          </Button>
        </div>
      </div>
    </div>
  );
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
