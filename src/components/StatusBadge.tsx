import type { JSX } from 'solid-js';

export type StatusBadgeTone = 'neutral' | 'ready' | 'warning' | 'error';

type StatusBadgeProps = {
  tone?: StatusBadgeTone;
  class?: string;
  children: JSX.Element;
};

const toneClasses: Record<StatusBadgeTone, string> = {
  neutral: 'border-neutral-200 bg-neutral-50 text-neutral-600',
  ready: 'border-neutral-200 bg-white text-neutral-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-red-200 bg-red-50 text-red-700',
};

export function StatusBadge(props: StatusBadgeProps) {
  return (
    <span
      class={[
        'inline-flex rounded-md border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em]',
        toneClasses[props.tone ?? 'neutral'],
        props.class ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {props.children}
    </span>
  );
}
