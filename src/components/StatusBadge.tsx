import type { JSX } from 'solid-js';

export type StatusBadgeTone = 'neutral' | 'ready' | 'warning' | 'error';

type StatusBadgeProps = {
  tone?: StatusBadgeTone;
  class?: string;
  children: JSX.Element;
};

const toneClasses: Record<StatusBadgeTone, string> = {
  neutral: 'border-slate-200 bg-white text-slate-600',
  ready: 'border-teal-200 bg-teal-50 text-teal-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-red-200 bg-red-50 text-red-700',
};

export function StatusBadge(props: StatusBadgeProps) {
  return (
    <span
      class={[
        'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
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
