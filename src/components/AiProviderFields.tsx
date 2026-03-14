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
    <div class="space-y-6">
      <FieldBlock label={props.baseUrlLabel}>
        <input
          type="url"
          value={props.settings.aiBaseURL}
          placeholder={props.baseUrlPlaceholder}
          class="mt-2 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400"
          onInput={(event) => props.onBaseUrlInput(event.currentTarget.value)}
        />
        <div class="mt-2 text-xs text-neutral-500">
          {props.permissionLabel}:{' '}
          <span
            class={
              props.permissionGranted == null
                ? 'text-neutral-500'
                : props.permissionGranted
                  ? 'text-neutral-900'
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
            class="mt-2 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400"
            onInput={(event) => props.onModelInput(event.currentTarget.value)}
          />
        </FieldBlock>
        <FieldBlock label={props.apiKeyLabel}>
          <input
            type="password"
            value={props.settings.aiApiKey}
            placeholder={props.apiKeyPlaceholder}
            class="mt-2 w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400"
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
      <div class="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
        {props.label}
      </div>
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
