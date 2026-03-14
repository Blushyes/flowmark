import { type JSX, Show } from 'solid-js';

import type { FlowmarkSettings } from '@/src/shared/types';

type ProviderFields = Pick<FlowmarkSettings, 'aiBaseURL' | 'aiApiKey' | 'aiModel'>;

interface Props {
  settings: ProviderFields;
  permissionGranted: boolean | null;
  baseUrlLabel: string;
  baseUrlPlaceholder: string;
  permissionLabel: string;
  modelLabel: string;
  modelPlaceholder: string;
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  unknownLabel: string;
  grantedLabel: string;
  notGrantedLabel: string;
  onBaseUrlInput: (value: string) => void;
  onModelInput: (value: string) => void;
  onApiKeyInput: (value: string) => void;
  footer?: JSX.Element;
}

export function AiProviderFields(props: Props) {
  return (
    <div class="space-y-5">
      <FieldBlock label={props.baseUrlLabel}>
        <input
          type="url"
          value={props.settings.aiBaseURL}
          placeholder={props.baseUrlPlaceholder}
          class="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
          onInput={(event) => props.onBaseUrlInput(event.currentTarget.value)}
        />
        <div class="mt-2 text-xs text-slate-600">
          {props.permissionLabel}:{' '}
          <span
            class={
              props.permissionGranted == null
                ? 'text-slate-600'
                : props.permissionGranted
                  ? 'text-teal-700'
                  : 'text-amber-700'
            }
          >
            {permissionText(
              props.permissionGranted,
              props.unknownLabel,
              props.grantedLabel,
              props.notGrantedLabel,
            )}
          </span>
        </div>
      </FieldBlock>

      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FieldBlock label={props.modelLabel}>
          <input
            type="text"
            value={props.settings.aiModel}
            placeholder={props.modelPlaceholder}
            class="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            onInput={(event) => props.onModelInput(event.currentTarget.value)}
          />
        </FieldBlock>
        <FieldBlock label={props.apiKeyLabel}>
          <input
            type="password"
            value={props.settings.aiApiKey}
            placeholder={props.apiKeyPlaceholder}
            class="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            onInput={(event) => props.onApiKeyInput(event.currentTarget.value)}
          />
        </FieldBlock>
      </div>

      <Show when={props.footer}>{(footer) => footer()}</Show>
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

function permissionText(
  granted: boolean | null,
  unknownLabel: string,
  grantedLabel: string,
  notGrantedLabel: string,
): string {
  if (granted == null) return unknownLabel;
  return granted ? grantedLabel : notGrantedLabel;
}
