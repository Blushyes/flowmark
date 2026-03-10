import type { JSX } from 'solid-js';
import { createEffect, createMemo, createSignal, onMount, Show } from 'solid-js';

import { Button } from '@/src/components/Button';
import { StatusBadge } from '@/src/components/StatusBadge';
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
    const status = saveStatus();
    return status.kind === 'error' ? status.message : null;
  });

  const aiOriginPattern = createMemo(() => {
    const current = settings();
    if (!current?.aiBaseURL) return null;
    try {
      return toOriginPermissionPattern(current.aiBaseURL);
    } catch {
      return null;
    }
  });

  const providerStatus = createMemo(() => {
    const current = settings();
    if (!current) return { label: 'Loading', tone: 'neutral' as const };
    if (!current.aiBaseURL || !current.aiModel) {
      return { label: 'Setup needed', tone: 'warning' as const };
    }
    if (permissionGranted() === false) {
      return { label: 'Permission missing', tone: 'warning' as const };
    }
    return { label: 'Ready', tone: 'ready' as const };
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
    <div class="flowmark-scroll-root absolute inset-0 overflow-y-auto overflow-x-hidden bg-slate-50 px-4 py-6 text-slate-900 scrollbar-thin scrollbar-w-1 scrollbar-track-transparent scrollbar-thumb-rounded-full scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400">
      <div class="mx-auto max-w-3xl">
        <header class="border-b border-slate-200 pb-5">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <img src="/icon/32.png" alt="Flowmark" class="h-10 w-10 rounded-xl ring-1 ring-black/5" />
              <div>
                <h1 class="text-xl font-semibold tracking-[-0.01em] text-slate-950">Flowmark Settings</h1>
                <p class="mt-1 text-sm text-slate-600">
                  Configure your AI provider, recommendation behavior, and auto-accept flow.
                </p>
              </div>
            </div>
            <StatusBadge tone={providerStatus().tone}>
              {providerStatus().label}
            </StatusBadge>
          </div>
        </header>

        <Show when={settings()} fallback={<Skeleton />}>
          {(current) => (
            <div class="space-y-6 py-6">
              <section class="rounded-3xl border border-slate-200 bg-white">
                <SectionHeader
                  title="Recommendation"
                  description="Tune when Flowmark suggests, auto-applies, and sends page content."
                />

                <div class="border-t border-slate-200">
                  <ToggleRow
                    label="Enable smart recommendation"
                    description="Show a suggestion pill after saving a bookmark."
                    checked={current().enabled}
                    onInput={(checked) => update('enabled', checked)}
                  />
                  <ToggleRow
                    label="Auto-accept"
                    description="Automatically move or rename after a countdown."
                    checked={current().autoAcceptEnabled}
                    onInput={(checked) => update('autoAcceptEnabled', checked)}
                  />
                  <NumberRow
                    label="Auto-accept seconds"
                    description="0-60 seconds"
                    value={current().autoAcceptSeconds}
                    min="0"
                    max="60"
                    disabled={!current().autoAcceptEnabled}
                    onInput={(value) => update('autoAcceptSeconds', value)}
                  />
                  <ToggleRow
                    label="Send page text to AI"
                    description="Off by default. When on, page text is truncated before sending."
                    checked={current().sendPageText}
                    onInput={(checked) => update('sendPageText', checked)}
                  />
                  <NumberRow
                    label="Max page chars"
                    description="500-50,000 characters"
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
                  title="AI Provider"
                  description="Use any OpenAI-compatible endpoint. Host permission is requested on save."
                />

                <div class="border-t border-slate-200 px-5 py-5">
                  <div class="space-y-5">
                    <FieldBlock label="Base URL (normalized to /v1)">
                      <input
                        type="url"
                        value={current().aiBaseURL}
                        placeholder="https://api.openai.com/v1"
                        class="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                        onInput={(event) => update('aiBaseURL', event.currentTarget.value)}
                      />
                      <div class="mt-2 text-xs text-slate-600">
                        Permission:{' '}
                    <span class={permissionGranted() == null ? 'text-slate-600' : permissionGranted() ? 'text-teal-700' : 'text-amber-700'}>
                      {permissionGranted() == null
                        ? 'unknown'
                        : permissionGranted()
                              ? 'granted'
                              : 'not granted'}
                        </span>
                      </div>
                    </FieldBlock>

                    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <FieldBlock label="Model">
                        <input
                          type="text"
                          value={current().aiModel}
                          placeholder="gpt-4o-mini"
                          class="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                          onInput={(event) => update('aiModel', event.currentTarget.value)}
                        />
                      </FieldBlock>
                      <FieldBlock label="API Key (optional)">
                        <input
                          type="password"
                          value={current().aiApiKey}
                          placeholder="sk-..."
                          class="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                          onInput={(event) => update('aiApiKey', event.currentTarget.value)}
                        />
                      </FieldBlock>
                    </div>
                  </div>
                </div>
              </section>

              <footer class="flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
                <div class="text-sm text-slate-600">
                  <Show when={saveStatus().kind === 'saved'}>
                    <span class="text-teal-700">Saved.</span>
                  </Show>
                  <Show when={saveErrorMessage()}>
                    {(message) => <span class="text-red-700">{message()}</span>}
                  </Show>
                </div>
                <Button type="button" onClick={handleSave}>
                  Save settings
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

function FieldBlock(props: { label: string; children: JSX.Element }) {
  return (
    <label class="block">
      <div class="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{props.label}</div>
      {props.children}
    </label>
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

function clampInt(value: number, min: number, max: number): number {
  const result = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.min(max, Math.max(min, result));
}
