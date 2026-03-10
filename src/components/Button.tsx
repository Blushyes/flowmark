import type { JSX } from 'solid-js';
import { splitProps } from 'solid-js';

type ButtonVariant = 'primary' | 'secondary';
type ButtonSize = 'sm' | 'md';

type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-slate-950 text-white hover:bg-slate-800',
  secondary: 'bg-white/80 text-slate-700 ring-1 ring-slate-200/80 hover:bg-white',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 rounded-full px-3 text-xs font-medium',
  md: 'h-11 rounded-2xl px-4 text-sm font-medium',
};

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ['class', 'variant', 'size', 'block']);

  return (
    <button
      {...rest}
      class={[
        'inline-flex items-center justify-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70 disabled:cursor-not-allowed disabled:opacity-60',
        variantClasses[local.variant ?? 'primary'],
        sizeClasses[local.size ?? 'md'],
        local.block ? 'w-full' : '',
        local.class ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
