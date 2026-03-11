import { createEffect, createMemo, createSignal, onCleanup, Show } from 'solid-js';

import { messaging } from '@/src/shared/messaging';
import type { BookmarkDecisionCard, Locale } from '@/src/shared/types';

type Props = {
  card: BookmarkDecisionCard;
  locale: Locale;
  requestRemove: () => void;
};

const EXIT_ANIMATION_MS = 240;

export function BookmarkSuggestionPill(props: Props) {
  const [exiting, setExiting] = createSignal(false);
  const [secondsLeft, setSecondsLeft] = createSignal<number>(0);
  const [countdownProgress, setCountdownProgress] = createSignal<number>(0);

  const isRecommendation = createMemo(() => props.card.kind === 'recommendation');
  const isWarning = createMemo(() => props.card.kind === 'warning' || props.card.kind === 'decision');
  const isError = createMemo(() => props.card.kind === 'error');
  const primaryAction = createMemo(() => props.card.actions.find((action) => action.variant === 'primary') ?? null);

  const closeWithAnimation = (after?: () => void) => {
    if (exiting()) return;
    setExiting(true);
    window.setTimeout(() => {
      after?.();
      props.requestRemove();
    }, EXIT_ANIMATION_MS);
  };

  const submitAction = (actionId: string, payload?: BookmarkDecisionCard['actions'][number]['payload']) => {
    closeWithAnimation(() => {
      void messaging.sendMessage('submitBookmarkCardAction', {
        bookmarkId: props.card.bookmarkId,
        cardId: props.card.id,
        actionId,
        payload,
      });
    });
  };

  const runAction = (action: BookmarkDecisionCard['actions'][number]) => {
    if (action.intent === 'open-options') {
      closeWithAnimation(() => {
        void messaging.sendMessage('openOptions');
      });
      return;
    }
    submitAction(action.id, action.payload);
  };

  createEffect(() => {
    const autoActionId = props.card.autoActionId;
    const autoDismissMs = props.card.autoDismissMs;
    if (!autoActionId || !autoDismissMs) return;

    if (isRecommendation()) {
      const total = Math.max(0, Math.trunc(autoDismissMs / 1000));
      if (total <= 0) {
        submitAction(autoActionId, primaryAction()?.payload);
        return;
      }

      setSecondsLeft(total);
      setCountdownProgress(100);

      const startTime = Date.now();
      const timeoutId = window.setTimeout(() => {
        submitAction(autoActionId, primaryAction()?.payload);
      }, autoDismissMs);
      const intervalId = window.setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, total - elapsedSec);
        setSecondsLeft(remaining);
        const progress = Math.min(100, Math.max(0, (elapsedSec / total) * 100));
        setCountdownProgress(100 - progress);
        if (remaining <= 0) window.clearInterval(intervalId);
      }, 250);

      onCleanup(() => {
        window.clearTimeout(timeoutId);
        window.clearInterval(intervalId);
      });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      submitAction(autoActionId);
    }, autoDismissMs);
    onCleanup(() => window.clearTimeout(timeoutId));
  });

  return (
    <div class="pointer-events-auto max-w-[560px]">
      <div
        class={[
          'flex items-center gap-3 border border-slate-100 bg-white px-4 py-3 font-sans shadow-md',
          isRecommendation() ? 'rounded-full' : 'rounded-3xl',
          exiting() ? 'flowmark-animate-out' : 'flowmark-animate-in',
          isError() ? 'flowmark-error-state' : '',
        ].join(' ')}
      >
        <div
          class={[
            'flex h-10 w-10 flex-none items-center justify-center rounded-full',
            isError()
              ? 'bg-red-100 text-red-600'
              : isWarning()
                ? 'bg-amber-100 text-amber-700'
                : 'bg-indigo-100 text-indigo-600',
          ].join(' ')}
        >
          <Show when={props.card.kind === 'info'}>
            <LoadingIcon />
          </Show>
          <Show when={props.card.kind === 'recommendation'}>
            <BookmarkIcon />
          </Show>
          <Show when={props.card.kind === 'warning'}>
            <WarningIcon />
          </Show>
          <Show when={props.card.kind === 'decision'}>
            <DuplicateIcon />
          </Show>
          <Show when={props.card.kind === 'error'}>
            <ErrorIcon />
          </Show>
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 overflow-visible">
            <Show when={props.card.kind === 'recommendation'}>
              <FolderIcon />
            </Show>
            <span class={isError() ? 'truncate text-sm font-medium text-red-700' : 'truncate text-sm font-medium text-slate-800'}>
              {props.card.headline}
            </span>
            <Show when={props.card.badge}>
              {(badge) => (
                <span class="flex-none rounded-sm bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                  {badge()}
                </span>
              )}
            </Show>
          </div>

          <Show when={props.card.body}>
            {(body) => (
              <div class={isError() ? 'mt-0.5 text-sm text-red-500' : 'mt-0.5 truncate text-sm text-slate-500'} title={body()}>
                {body()}
              </div>
            )}
          </Show>

          <Show when={props.card.meta && props.card.meta.length > 0}>
            <div class="mt-1 min-w-0">
              {props.card.meta?.map((item) => (
                <div class="truncate text-xs text-slate-500" title={item.value}>
                  {item.label ? `${item.label}: ` : ''}
                  {item.value}
                </div>
              ))}
            </div>
          </Show>
        </div>

        <div class="flex flex-none items-center gap-2">
          <Show when={isRecommendation() && primaryAction() && props.card.autoActionId === primaryAction()?.id && props.card.autoDismissMs}>
            <button
              type="button"
              class="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              title={primaryAction()?.label}
              onClick={() => runAction(primaryAction()!)}
            >
              <svg class="absolute inset-0 h-full w-full" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" stroke="#dcfce7" stroke-width="2" />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="#22c55e"
                  stroke-width="2"
                  stroke-dasharray="100"
                  stroke-dashoffset={countdownProgress()}
                />
              </svg>
              <span class="absolute text-xs font-bold text-emerald-800">{secondsLeft()}</span>
            </button>
          </Show>

          <div class="flex flex-wrap justify-end gap-2">
            {props.card.actions.map((action) => (
              <Show when={!(isRecommendation() && props.card.autoActionId === action.id && action.variant === 'primary')}>
                <button
                  type="button"
                  class={[
                    'flex h-8 items-center justify-center rounded-full px-3 text-xs font-medium',
                    action.variant === 'primary'
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : action.variant === 'danger'
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                  ].join(' ')}
                  onClick={() => runAction(action)}
                >
                  {action.label}
                </button>
              </Show>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-none text-slate-600">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function LoadingIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="flowmarkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#4F46E5" />
          <stop offset="100%" stop-color="#7DD3FC" />
        </linearGradient>
      </defs>
      <path class="flowmark-bookmark-path" d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="url(#flowmarkGradient)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <path class="flowmark-bookmark-pulse" d="M9 9h6M9 13h3" stroke="url(#flowmarkGradient)" stroke-width="2" stroke-linecap="round" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flowmark-error-icon">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 8h11v11" />
      <path d="M16 8H5v11" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
