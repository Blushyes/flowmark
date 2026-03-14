import { createEffect, createMemo, createSignal, onMount, Show } from 'solid-js';

import { AiProviderFields } from '@/src/components/AiProviderFields';
import { Button } from '@/src/components/Button';
import { StatusBadge } from '@/src/components/StatusBadge';
import {
  getBrowserUiLanguage,
  resolveLocale,
  useI18n,
} from '@/src/shared/i18n';
import { getSettings } from '@/src/shared/settings';
import {
  getAiPermissionGranted,
  getProviderStatus,
  saveFlowmarkSettings,
  type SettingsSaveStatus,
} from '@/src/shared/provider-settings';
import type { FlowmarkSettings, LocaleOverride } from '@/src/shared/types';

export default function App() {
  const [settings, setLocalSettings] = createSignal<FlowmarkSettings | null>(null);
  const [permissionGranted, setPermissionGranted] = createSignal<boolean | null>(null);
  const [saveStatus, setSaveStatus] = createSignal<SettingsSaveStatus>({ kind: 'idle' });

  const currentLocale = createMemo(() =>
    resolveLocale(settings()?.localeOverride ?? 'auto', getBrowserUiLanguage()),
  );
  const { t } = useI18n(currentLocale);

  const saveErrorMessage = createMemo(() => {
    const status = saveStatus();
    return status.kind === 'error' ? status.message : null;
  });

  const providerStatus = createMemo(() => {
    return getProviderStatus(settings(), permissionGranted(), {
      loading: t('common.loading'),
      setupNeeded: t('options.statusSetupNeeded'),
      permissionMissing: t('options.statusPermissionMissing'),
      ready: t('options.statusReady'),
    });
  });

  createEffect(() => {
    document.title = t('options.documentTitle');
  });

  createEffect(() => {
    void (async () => {
      const current = settings();
      if (!current) {
        setPermissionGranted(null);
        return;
      }

      const granted = await getAiPermissionGranted(current);
      setPermissionGranted(granted);
    })();
  });

  onMount(() => {
    void (async () => {
      const current = await getSettings();
      setLocalSettings(current);
    })();
  });

  const update = <K extends keyof FlowmarkSettings>(key: K, value: FlowmarkSettings[K]) => {
    const current = settings();
    if (!current) return;
    setLocalSettings({ ...current, [key]: value });
  };

  const handleSave = async () => {
    const current = settings();
    if (!current) return;

    setSaveStatus({ kind: 'idle' });

    try {
      const result = await saveFlowmarkSettings(current);
      setPermissionGranted(result.permissionGranted);
      setLocalSettings(result.next);

      if (result.recommendationDisabledByPermission) {
        setSaveStatus({
          kind: 'error',
          message: t('options.permissionDeniedDisabled'),
        });
        return;
      }

      setSaveStatus({ kind: 'saved' });
      setTimeout(() => setSaveStatus({ kind: 'idle' }), 2000);
    } catch {
      setSaveStatus({
        kind: 'error',
        message: t('options.saveFailed'),
      });
    }
  };

  return (
    <div class="flowmark-scroll-root absolute inset-0 overflow-y-auto overflow-x-hidden bg-slate-50 px-4 py-6 text-slate-900 scrollbar-thin scrollbar-w-1 scrollbar-track-transparent scrollbar-thumb-rounded-full scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400">
      <div class="mx-auto max-w-3xl">
        <header class="border-b border-slate-200 pb-5">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <img src="/icon/32.png" alt="FlowMark" class="h-10 w-10 shrink-0 bg-transparent" />
              <div>
                <h1 class="text-xl font-semibold tracking-[-0.01em] text-slate-950">{t('options.headingTitle')}</h1>
                <p class="mt-1 text-sm text-slate-600">{t('options.headingDescription')}</p>
              </div>
            </div>
            <StatusBadge tone={providerStatus().tone}>{providerStatus().label}</StatusBadge>
          </div>
        </header>

        <Show when={settings()} fallback={<Skeleton />}>
          {(current) => (
            <div class="space-y-6 py-6">
              <section class="rounded-3xl border border-slate-200 bg-white">
                <SectionHeader
                  title={t('options.recommendationTitle')}
                  description={t('options.recommendationDescription')}
                />

                <div class="border-t border-slate-200">
                  <SelectRow
                    label={t('options.languageLabel')}
                    description={t('options.languageDescription')}
                    value={current().localeOverride}
                    onInput={(value) => update('localeOverride', value)}
                    options={[
                      { value: 'auto', label: t('common.auto') },
                      { value: 'en', label: t('common.english') },
                      { value: 'zh-CN', label: t('common.chineseSimplified') },
                    ]}
                  />
                  <ToggleRow
                    label={t('options.enableRecommendationLabel')}
                    description={t('options.enableRecommendationDescription')}
                    checked={current().enabled}
                    onInput={(checked) => update('enabled', checked)}
                  />
                  <ToggleRow
                    label={t('options.duplicateCheckLabel')}
                    description={t('options.duplicateCheckDescription')}
                    checked={current().duplicateCheckEnabled}
                    onInput={(checked) => update('duplicateCheckEnabled', checked)}
                  />
                  <ToggleRow
                    label={t('options.pageQualityFilterLabel')}
                    description={t('options.pageQualityFilterDescription')}
                    checked={current().pageQualityFilterEnabled}
                    onInput={(checked) => update('pageQualityFilterEnabled', checked)}
                  />
                  <ToggleRow
                    label={t('options.summaryLabel')}
                    description={t('options.summaryDescription')}
                    checked={current().summaryEnabled}
                    onInput={(checked) => update('summaryEnabled', checked)}
                  />
                  <ToggleRow
                    label={t('options.autoAcceptLabel')}
                    description={t('options.autoAcceptDescription')}
                    checked={current().autoAcceptEnabled}
                    onInput={(checked) => update('autoAcceptEnabled', checked)}
                  />
                  <NumberRow
                    label={t('options.autoAcceptSecondsLabel')}
                    description={t('options.autoAcceptSecondsDescription')}
                    value={current().autoAcceptSeconds}
                    min="0"
                    max="60"
                    disabled={!current().autoAcceptEnabled}
                    onInput={(value) => update('autoAcceptSeconds', value)}
                  />
                  <ToggleRow
                    label={t('options.sendPageTextLabel')}
                    description={t('options.sendPageTextDescription')}
                    checked={current().sendPageText}
                    onInput={(checked) => update('sendPageText', checked)}
                  />
                  <NumberRow
                    label={t('options.maxPageCharsLabel')}
                    description={t('options.maxPageCharsDescription')}
                    value={current().maxPageChars}
                    min="500"
                    max="50000"
                    disabled={!current().sendPageText}
                    onInput={(value) => update('maxPageChars', value)}
                    last
                  />
                </div>
              </section>

              <section class="rounded-3xl border border-slate-200 bg-white">
                <SectionHeader
                  title={t('options.aiProviderTitle')}
                  description={t('options.aiProviderDescription')}
                />

                <div class="border-t border-slate-200 px-5 py-5">
                  <AiProviderFields
                    settings={current()}
                    permissionGranted={permissionGranted()}
                    baseUrlLabel={t('options.baseUrlLabel')}
                    baseUrlPlaceholder={t('options.baseUrlPlaceholder')}
                    permissionLabel={t('options.permissionLabel')}
                    modelLabel={t('options.modelLabel')}
                    modelPlaceholder={t('options.modelPlaceholder')}
                    apiKeyLabel={t('options.apiKeyLabel')}
                    apiKeyPlaceholder={t('options.apiKeyPlaceholder')}
                    unknownLabel={t('common.unknown')}
                    grantedLabel={t('common.granted')}
                    notGrantedLabel={t('common.notGranted')}
                    onBaseUrlInput={(value) => update('aiBaseURL', value)}
                    onModelInput={(value) => update('aiModel', value)}
                    onApiKeyInput={(value) => update('aiApiKey', value)}
                  />
                </div>
              </section>

              <footer class="flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
                <div class="text-sm text-slate-600">
                  <Show when={saveStatus().kind === 'saved'}>
                    <span class="text-teal-700">{t('common.saved')}</span>
                  </Show>
                  <Show when={saveErrorMessage()}>
                    {(message) => <span class="text-red-700">{message()}</span>}
                  </Show>
                </div>
                <Button type="button" onClick={handleSave}>
                  {t('options.saveSettings')}
                </Button>
              </footer>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}

function SectionHeader(props: { title: string; description: string }) {
  return (
    <div class="px-5 py-5">
      <h2 class="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{props.title}</h2>
      <p class="mt-2 text-sm text-slate-600">{props.description}</p>
    </div>
  );
}

function ToggleRow(props: {
  label: string;
  description: string;
  checked: boolean;
  onInput: (checked: boolean) => void;
}) {
  return (
    <label class="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 last:border-b-0">
      <div>
        <div class="text-sm font-medium text-slate-900">{props.label}</div>
        <div class="mt-1 text-xs text-slate-600">{props.description}</div>
      </div>
      <input
        type="checkbox"
        class="h-5 w-5 flex-none accent-slate-900"
        checked={props.checked}
        onInput={(event) => props.onInput(event.currentTarget.checked)}
      />
    </label>
  );
}

function NumberRow(props: {
  label: string;
  description: string;
  value: number;
  min: string;
  max: string;
  disabled: boolean;
  onInput: (value: number) => void;
  last?: boolean;
}) {
  return (
    <div class={['grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-[1fr_180px] sm:items-center', props.last ? '' : 'border-b border-slate-200'].join(' ')}>
      <div>
        <div class="text-sm font-medium text-slate-900">{props.label}</div>
        <div class="mt-1 text-xs text-slate-600">{props.description}</div>
      </div>
      <input
        type="number"
        min={props.min}
        max={props.max}
        value={props.value}
        class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
        onInput={(event) => props.onInput(toInt(event.currentTarget.value))}
        disabled={props.disabled}
      />
    </div>
  );
}

function SelectRow(props: {
  label: string;
  description: string;
  value: LocaleOverride;
  options: Array<{ value: LocaleOverride; label: string }>;
  onInput: (value: LocaleOverride) => void;
}) {
  return (
    <div class="grid grid-cols-1 gap-3 border-b border-slate-200 px-5 py-4 sm:grid-cols-[1fr_180px] sm:items-center">
      <div>
        <div class="text-sm font-medium text-slate-900">{props.label}</div>
        <div class="mt-1 text-xs text-slate-600">{props.description}</div>
      </div>
      <select
        value={props.value}
        class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
        onInput={(event) => props.onInput(event.currentTarget.value as LocaleOverride)}
      >
        <For each={props.options}>{(option) => <option value={option.value}>{option.label}</option>}</For>
      </select>
    </div>
  );
}

function Skeleton() {
  return (
    <div class="space-y-6 py-6">
      <div class="rounded-3xl border border-slate-200 bg-white p-5">
        <div class="h-4 w-40 animate-pulse rounded bg-slate-100" />
        <div class="mt-3 h-3 w-72 animate-pulse rounded bg-slate-100" />
        <div class="mt-6 h-12 w-full animate-pulse rounded-2xl bg-slate-100" />
      </div>
      <div class="rounded-3xl border border-slate-200 bg-white p-5">
        <div class="h-4 w-40 animate-pulse rounded bg-slate-100" />
        <div class="mt-3 h-3 w-60 animate-pulse rounded bg-slate-100" />
        <div class="mt-6 h-28 w-full animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

function toInt(value: string): number {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : 0;
}
