import type { StatusBadgeTone } from '@/src/components/StatusBadge';

import { normalizeAiBaseURL, setSettings, toOriginPermissionPattern } from './settings';
import type { FlowmarkSettings } from './types';

export type SettingsSaveStatus =
  | { kind: 'idle' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string };

export interface ProviderStatusLabels {
  loading: string;
  setupNeeded: string;
  permissionMissing: string;
  ready: string;
}

export interface ProviderStatus {
  label: string;
  tone: StatusBadgeTone;
}

export interface SaveFlowmarkSettingsResult {
  next: FlowmarkSettings;
  permissionGranted: boolean | null;
  recommendationDisabledByPermission: boolean;
}

export function getAiOriginPattern(baseURL: string): string | null {
  if (!baseURL) return null;

  try {
    return toOriginPermissionPattern(baseURL);
  } catch {
    return null;
  }
}

export async function getAiPermissionGranted(
  settings: Pick<FlowmarkSettings, 'aiBaseURL'>,
): Promise<boolean | null> {
  const pattern = getAiOriginPattern(settings.aiBaseURL);
  if (!pattern) return null;

  try {
    return await browser.permissions.contains({ origins: [pattern] });
  } catch {
    return null;
  }
}

export function getProviderStatus(
  settings: Pick<FlowmarkSettings, 'aiBaseURL' | 'aiModel'> | null,
  permissionGranted: boolean | null,
  labels: ProviderStatusLabels,
): ProviderStatus {
  if (!settings) {
    return { label: labels.loading, tone: 'neutral' };
  }

  if (!settings.aiBaseURL || !settings.aiModel) {
    return { label: labels.setupNeeded, tone: 'warning' };
  }

  if (permissionGranted === false) {
    return { label: labels.permissionMissing, tone: 'warning' };
  }

  return { label: labels.ready, tone: 'ready' };
}

export async function saveFlowmarkSettings(
  current: FlowmarkSettings,
): Promise<SaveFlowmarkSettingsResult> {
  const normalizedBaseURL = current.aiBaseURL ? normalizeAiBaseURL(current.aiBaseURL) : '';
  let enabled = current.enabled;
  let permissionGranted: boolean | null = null;

  if (normalizedBaseURL) {
    const originPattern = toOriginPermissionPattern(normalizedBaseURL);
    permissionGranted = await browser.permissions.request({ origins: [originPattern] });

    if (!permissionGranted && enabled) {
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

  return {
    next,
    permissionGranted,
    recommendationDisabledByPermission: current.enabled && !enabled,
  };
}

function clampInt(value: number, min: number, max: number): number {
  const result = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.min(max, Math.max(min, result));
}
