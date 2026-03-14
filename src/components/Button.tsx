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
  primary:
    'border border-neutral-900 bg-neutral-900 text-white hover:border-neutral-800 hover:bg-neutral-800',
  secondary:
    'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-md px-3 text-xs font-medium tracking-tight',
  md: 'h-9 rounded-md px-4 text-sm font-medium tracking-tight',
};

export function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, ['class', 'variant', 'size', 'block']);

  return (
    <button
      {...rest}
      class={[
        'inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-neutral-900/10 disabled:cursor-not-allowed disabled:opacity-50',
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
