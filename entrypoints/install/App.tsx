import { createMemo, createSignal, onMount, Show } from 'solid-js';

import { AiProviderFields } from '@/src/components/AiProviderFields';
import { Button } from '@/src/components/Button';
import { ReleasePage } from '@/src/release-pages/ReleasePage';
import { StatusBadge } from '@/src/components/StatusBadge';
import {
  getBrowserUiLanguage,
  resolveLocale,
  useI18n,
} from '@/src/shared/i18n';
import {
  getAiPermissionGranted,
  getProviderStatus,
  saveFlowmarkSettings,
  type SettingsSaveStatus,
} from '@/src/shared/provider-settings';
import { getSettings } from '@/src/shared/settings';
import type { FlowmarkSettings } from '@/src/shared/types';

export default function App() {
  const [settings, setSettings] = createSignal<FlowmarkSettings | null>(null);
  const [permissionGranted, setPermissionGranted] = createSignal<boolean | null>(null);
  const [saveStatus, setSaveStatus] = createSignal<SettingsSaveStatus>({ kind: 'idle' });

  const currentLocale = createMemo(() =>
    resolveLocale(settings()?.localeOverride ?? 'auto', getBrowserUiLanguage()),
  );
  const { t } = useI18n(currentLocale);

  const providerStatus = createMemo(() =>
    getProviderStatus(settings(), permissionGranted(), {
      loading: t('common.loading'),
      setupNeeded: t('options.statusSetupNeeded'),
      permissionMissing: t('options.statusPermissionMissing'),
      ready: t('options.statusReady'),
    }),
  );

  const saveErrorMessage = createMemo(() => {
    const status = saveStatus();
    return status.kind === 'error' ? status.message : null;
  });

  onMount(() => {
    void (async () => {
      const current = await getSettings();
      setSettings(current);
      const granted = await getAiPermissionGranted(current);
      setPermissionGranted(granted);
    })();
  });

  const update = <K extends keyof FlowmarkSettings>(key: K, value: FlowmarkSettings[K]) => {
    const current = settings();
    if (!current) return;
    setSettings({ ...current, [key]: value });
  };

  const handleSave = async () => {
    const current = settings();
    if (!current) return;

    setSaveStatus({ kind: 'idle' });

    try {
      const result = await saveFlowmarkSettings(current);
      setSettings(result.next);
      setPermissionGranted(result.permissionGranted);

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
    <ReleasePage
      pageKind="install"
      installAddon={
        <section class="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6 sm:py-6">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {t('install.inlineSetupTitle')}
              </div>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {t('install.inlineSetupDescription')}
              </p>
            </div>
            <StatusBadge tone={providerStatus().tone}>{providerStatus().label}</StatusBadge>
          </div>

          <div class="mt-5">
            <Show when={settings()}>
              {(current) => (
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
                  footer={
                    <div class="flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
                      <div class="text-sm text-slate-600">
                        <Show when={saveStatus().kind === 'saved'}>
                          <span class="text-teal-700">{t('common.saved')}</span>
                        </Show>
                        <Show when={saveErrorMessage()}>
                          {(message) => <span class="text-red-700">{message()}</span>}
                        </Show>
                      </div>
                      <Button type="button" onClick={handleSave}>
                        {t('install.inlineSaveLabel')}
                      </Button>
                    </div>
                  }
                />
              )}
            </Show>
          </div>
        </section>
      }
    />
  );
}
