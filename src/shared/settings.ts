import { z } from 'zod';

import { DEFAULT_SETTINGS, type FlowmarkSettings } from './types';

const settingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    autoAcceptEnabled: z.boolean().optional(),
    autoAcceptSeconds: z.number().int().min(0).max(60).optional(),
    sendPageText: z.boolean().optional(),
    maxPageChars: z.number().int().min(500).max(50_000).optional(),
    aiBaseURL: z.string().optional(),
    aiApiKey: z.string().optional(),
    aiModel: z.string().optional(),
  })
  .strict();

export async function getSettings(): Promise<FlowmarkSettings> {
  const raw = await browser.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const parsed = settingsSchema.safeParse(raw);
  const data = parsed.success ? parsed.data : {};

  return {
    ...DEFAULT_SETTINGS,
    ...data,
    aiBaseURL: (data.aiBaseURL ?? DEFAULT_SETTINGS.aiBaseURL).trim(),
    aiModel: (data.aiModel ?? DEFAULT_SETTINGS.aiModel).trim(),
    autoAcceptSeconds: clampInt(
      data.autoAcceptSeconds ?? DEFAULT_SETTINGS.autoAcceptSeconds,
      0,
      60,
    ),
    maxPageChars: clampInt(
      data.maxPageChars ?? DEFAULT_SETTINGS.maxPageChars,
      500,
      50_000,
    ),
  };
}

export async function setSettings(
  next: Partial<FlowmarkSettings>,
): Promise<void> {
  await browser.storage.local.set(next);
}

export function normalizeAiBaseURL(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return '';

  const url = new URL(trimmed);
  const pathname = url.pathname.replace(/\/+$/, '');
  if (pathname.endsWith('/v1')) {
    url.pathname = pathname;
    return url.toString().replace(/\/+$/, '');
  }

  url.pathname = `${pathname}/v1`.replace(/\/+/, '/');
  return url.toString().replace(/\/+$/, '');
}

export function toOriginPermissionPattern(baseURL: string): string {
  const url = new URL(baseURL);
  return `${url.origin}/*`;
}

function clampInt(value: number, min: number, max: number): number {
  const v = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.min(max, Math.max(min, v));
}

