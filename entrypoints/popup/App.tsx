import { createEffect, createMemo, createSignal, onMount, Show } from 'solid-js';

import { getSettings, setSettings, toOriginPermissionPattern } from '@/src/shared/settings';
import type { FlowmarkSettings } from '@/src/shared/types';

export default function App() {
  const [settings, setLocalSettings] = createSignal<FlowmarkSettings | null>(null);
  const [permissionGranted, setPermissionGranted] = createSignal<boolean | null>(null);

  const originPattern = createMemo(() => {
    const s = settings();
    if (!s?.aiBaseURL) return null;
    try {
      return toOriginPermissionPattern(s.aiBaseURL);
    } catch {
      return null;
    }
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
      const s = await getSettings();
      setLocalSettings(s);
    })();
  });

  const openOptions = () => {
    void browser.runtime.openOptionsPage();
  };

  const toggleEnabled = async () => {
    const s = settings();
    if (!s) return;
    const next = { ...s, enabled: !s.enabled };
    setLocalSettings(next);
    await setSettings({ enabled: next.enabled });
  };

  return (
    <div class="w-[360px] p-3">
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-base font-semibold text-slate-900">Flowmark</div>
            <div class="mt-0.5 text-xs text-slate-600">Smart bookmark suggestions</div>
          </div>
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
            onClick={openOptions}
          >
            Settings
          </button>
        </div>

        <div class="mt-4 space-y-2">
          <Show when={settings()} fallback={<Row label="Status" value="Loading..." />}>
            {(s) => (
              <>
                <Row
                  label="Recommendation"
                  value={s().enabled ? 'Enabled' : 'Disabled'}
                  valueClass={s().enabled ? 'text-emerald-700' : 'text-slate-600'}
                />
                <Row
                  label="Auto-accept"
                  value={s().autoAcceptEnabled ? `${s().autoAcceptSeconds}s` : 'Off'}
                />
                <Row
                  label="AI Base URL"
                  value={s().aiBaseURL ? safeOrigin(s().aiBaseURL) : 'Not set'}
                />
                <Row label="AI Model" value={s().aiModel || 'Not set'} />
                <Row
                  label="Host permission"
                  value={
                    permissionGranted() == null
                      ? 'Unknown'
                      : permissionGranted()
                        ? 'Granted'
                        : 'Not granted'
                  }
                  valueClass={
                    permissionGranted() == null
                      ? 'text-slate-600'
                      : permissionGranted()
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                  }
                />
              </>
            )}
          </Show>
        </div>

        <div class="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
            onClick={openOptions}
          >
            Open Settings
          </button>
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
            onClick={toggleEnabled}
          >
            Toggle
          </button>
        </div>
      </div>
    </div>
  );
}

function Row(props: { label: string; value: string; valueClass?: string }) {
  return (
    <div class="flex items-center justify-between gap-3">
      <div class="text-xs text-slate-600">{props.label}</div>
      <div class={`text-xs font-medium text-slate-900 ${props.valueClass ?? ''}`.trim()}>
        {props.value}
      </div>
    </div>
  );
}

function safeOrigin(baseURL: string): string {
  try {
    return new URL(baseURL).origin;
  } catch {
    return 'Invalid';
  }
}
