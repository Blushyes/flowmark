import { createEffect, createMemo, createSignal, onMount, Show } from 'solid-js';

import { getSettings, normalizeAiBaseURL, setSettings, toOriginPermissionPattern } from '@/src/shared/settings';
import type { FlowmarkSettings } from '@/src/shared/types';

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string };

export default function App() {
  const [settings, setLocalSettings] = createSignal<FlowmarkSettings | null>(null);
  const [permissionGranted, setPermissionGranted] = createSignal<boolean | null>(null);
  const [saveStatus, setSaveStatus] = createSignal<SaveStatus>({ kind: 'idle' });

  const saveErrorMessage = createMemo(() => {
    const st = saveStatus();
    return st.kind === 'error' ? st.message : null;
  });

  const aiOriginPattern = createMemo(() => {
    const s = settings();
    if (!s?.aiBaseURL) return null;
    try {
      return toOriginPermissionPattern(s.aiBaseURL);
    } catch {
      return null;
    }
  });

  createEffect(() => {
    const pattern = aiOriginPattern();
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
      const normalizedBaseURL = current.aiBaseURL ? normalizeAiBaseURL(current.aiBaseURL) : '';
      let enabled = current.enabled;

      if (normalizedBaseURL) {
        const originPattern = toOriginPermissionPattern(normalizedBaseURL);
        const granted = await browser.permissions.request({ origins: [originPattern] });
        setPermissionGranted(granted);

        if (!granted && enabled) {
          enabled = false;
        }
      }

      const next: FlowmarkSettings = {
        ...current,
        enabled,
        aiBaseURL: normalizedBaseURL,
        autoAcceptSeconds: clampInt(current.autoAcceptSeconds, 0, 60),
        maxPageChars: clampInt(current.maxPageChars, 500, 50_000),
      };

      await setSettings(next);
      setLocalSettings(next);

      if (current.enabled && !enabled) {
        setSaveStatus({
          kind: 'error',
          message: 'Host permission was denied. Recommendation has been disabled.',
        });
        return;
      }

      setSaveStatus({ kind: 'saved' });
      setTimeout(() => setSaveStatus({ kind: 'idle' }), 2000);
    } catch (error) {
      setSaveStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Failed to save settings.',
      });
    }
  };

  return (
    <div class="min-h-full p-4">
      <div class="mx-auto max-w-2xl space-y-4">
        <header class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 class="text-lg font-semibold text-slate-900">Flowmark Settings</h1>
          <p class="mt-1 text-sm text-slate-600">
            Configure an OpenAI-compatible provider to enable bookmark recommendations.
          </p>
        </header>

        <Show when={settings()} fallback={<Skeleton />}>
          {(s) => (
            <>
              <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 class="text-sm font-semibold text-slate-900">Recommendation</h2>

                <div class="mt-3 grid grid-cols-1 gap-3">
                  <label class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                    <div>
                      <div class="text-sm font-medium text-slate-900">Enable smart recommendation</div>
                      <div class="text-xs text-slate-600">Show a suggestion pill after saving a bookmark.</div>
                    </div>
                    <input
                      type="checkbox"
                      class="h-5 w-5 accent-slate-900"
                      checked={s().enabled}
                      onInput={(e) => update('enabled', e.currentTarget.checked)}
                    />
                  </label>

                  <label class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                    <div>
                      <div class="text-sm font-medium text-slate-900">Auto-accept</div>
                      <div class="text-xs text-slate-600">Automatically move/rename after a countdown.</div>
                    </div>
                    <input
                      type="checkbox"
                      class="h-5 w-5 accent-slate-900"
                      checked={s().autoAcceptEnabled}
                      onInput={(e) => update('autoAcceptEnabled', e.currentTarget.checked)}
                    />
                  </label>

                  <div class="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 sm:items-center">
                    <div>
                      <div class="text-sm font-medium text-slate-900">Auto-accept seconds</div>
                      <div class="text-xs text-slate-600">0-60 seconds</div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={s().autoAcceptSeconds}
                      class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 focus:border-slate-400"
                      onInput={(e) => update('autoAcceptSeconds', toInt(e.currentTarget.value))}
                      disabled={!s().autoAcceptEnabled}
                    />
                  </div>

                  <label class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                    <div>
                      <div class="text-sm font-medium text-slate-900">Send page text to AI</div>
                      <div class="text-xs text-slate-600">Off by default. When on, text is truncated.</div>
                    </div>
                    <input
                      type="checkbox"
                      class="h-5 w-5 accent-slate-900"
                      checked={s().sendPageText}
                      onInput={(e) => update('sendPageText', e.currentTarget.checked)}
                    />
                  </label>

                  <div class="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 sm:items-center">
                    <div>
                      <div class="text-sm font-medium text-slate-900">Max page chars</div>
                      <div class="text-xs text-slate-600">500-50,000 characters</div>
                    </div>
                    <input
                      type="number"
                      min="500"
                      max="50000"
                      value={s().maxPageChars}
                      class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 focus:border-slate-400"
                      onInput={(e) => update('maxPageChars', toInt(e.currentTarget.value))}
                      disabled={!s().sendPageText}
                    />
                  </div>
                </div>
              </section>

              <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 class="text-sm font-semibold text-slate-900">AI Provider (OpenAI Compatible)</h2>

                <div class="mt-3 grid grid-cols-1 gap-3">
                  <div>
                    <label class="text-xs font-medium text-slate-700">Base URL (will normalize to /v1)</label>
                    <input
                      type="url"
                      value={s().aiBaseURL}
                      placeholder="https://api.openai.com/v1"
                      class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                      onInput={(e) => update('aiBaseURL', e.currentTarget.value)}
                    />
                    <div class="mt-1 text-xs text-slate-600">
                      Permission:{' '}
                      <span class={permissionGranted() ? 'text-emerald-700' : 'text-amber-700'}>
                        {permissionGranted() == null
                          ? 'unknown'
                          : permissionGranted()
                            ? 'granted'
                            : 'not granted'}
                      </span>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label class="text-xs font-medium text-slate-700">Model</label>
                      <input
                        type="text"
                        value={s().aiModel}
                        placeholder="gpt-4o-mini"
                        class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                        onInput={(e) => update('aiModel', e.currentTarget.value)}
                      />
                    </div>
                    <div>
                      <label class="text-xs font-medium text-slate-700">API Key (optional)</label>
                      <input
                        type="password"
                        value={s().aiApiKey}
                        placeholder="sk-..."
                        class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                        onInput={(e) => update('aiApiKey', e.currentTarget.value)}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <footer class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div class="text-xs text-slate-600">
                  <Show when={saveStatus().kind === 'saved'}>Saved.</Show>
                  <Show when={saveErrorMessage()}>
                    {(msg) => <span class="text-red-700">{msg()}</span>}
                  </Show>
                </div>
                <button
                  type="button"
                  class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  onClick={handleSave}
                >
                  Save
                </button>
              </footer>
            </>
          )}
        </Show>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="h-4 w-40 animate-pulse rounded bg-slate-100" />
      <div class="mt-3 h-3 w-72 animate-pulse rounded bg-slate-100" />
      <div class="mt-6 h-10 w-full animate-pulse rounded bg-slate-100" />
    </div>
  );
}

function toInt(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

function clampInt(value: number, min: number, max: number): number {
  const v = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.min(max, Math.max(min, v));
}
