import { createEffect, createMemo, createSignal, onMount, Show } from 'solid-js';

import { Button } from '@/src/components/Button';
import { StatusBadge } from '@/src/components/StatusBadge';
import { openSettingsPage } from '@/src/shared/open-settings-page';
import { getSettings, setSettings, toOriginPermissionPattern } from '@/src/shared/settings';
import type { FlowmarkSettings } from '@/src/shared/types';

export default function App() {
  const [settings, setLocalSettings] = createSignal<FlowmarkSettings | null>(null);
  const [permissionGranted, setPermissionGranted] = createSignal<boolean | null>(null);

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
        label: 'Loading',
        tone: 'neutral' as const,
      };
    }

    if (!current.aiBaseURL || !current.aiModel) {
      return {
        label: 'Setup needed',
        tone: 'warning' as const,
      };
    }

    if (permissionGranted() === false) {
      return {
        label: 'Permission missing',
        tone: 'warning' as const,
      };
    }

    return {
      label: 'Ready',
      tone: 'ready' as const,
    };
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
            <img src="/icon/32.png" alt="Flowmark" class="h-9 w-9 rounded-xl ring-1 ring-black/5" />
            <div class="min-w-0">
              <div class="text-[15px] font-semibold tracking-[-0.01em] text-slate-950">Flowmark</div>
              <div class="text-xs text-slate-600">Smart bookmark routing, right after save</div>
            </div>
          </div>

          <Button type="button" variant="secondary" size="sm" onClick={openOptions}>
            Settings
          </Button>
        </div>

        <div class="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3">
          <div>
            <div class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Recommendation</div>
            <div class="mt-1 text-sm font-semibold text-slate-900">
              <Show when={settings()} fallback={'Loading...'}>
                {(current) => (current().enabled ? 'Enabled' : 'Paused')}
              </Show>
            </div>
          </div>

          <button
            type="button"
            aria-label="Toggle recommendation"
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
              Auto accept {settings()?.autoAcceptSeconds}s
            </StatusBadge>
          </Show>
        </div>

        <div class="mt-4 flex-1 rounded-[24px] border border-slate-200 bg-white">
          <SectionRow
            label="AI endpoint"
            value={settings()?.aiBaseURL ? safeOrigin(settings()!.aiBaseURL) : 'Not configured'}
          />
          <SectionRow label="Model" value={settings()?.aiModel || 'Not configured'} />
          <SectionRow
            label="Permission"
            value={permissionLabel(permissionGranted())}
            valueClass={permissionTone(permissionGranted())}
          />
          <SectionRow
            label="Page text"
            value={settings()?.sendPageText ? `On · ${settings()?.maxPageChars} chars` : 'Off'}
            last
          />
        </div>

        <div class="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <Button type="button" onClick={openOptions}>
            Open full settings
          </Button>
          <Button type="button" variant="secondary" onClick={toggleEnabled}>
            {settings()?.enabled ? 'Pause' : 'Enable'}
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
      <div class={['max-w-[185px] truncate text-right text-xs font-semibold text-slate-900', props.valueClass ?? ''].join(' ')}>
        {props.value}
      </div>
    </div>
  );
}

function permissionLabel(granted: boolean | null): string {
  if (granted == null) return 'Unknown';
  return granted ? 'Granted' : 'Not granted';
}

function permissionTone(granted: boolean | null): string {
  if (granted == null) return 'text-slate-600';
  return granted ? 'text-teal-700' : 'text-amber-700';
}

function safeOrigin(baseURL: string): string {
  try {
    return new URL(baseURL).origin;
  } catch {
    return 'Invalid';
  }
}
