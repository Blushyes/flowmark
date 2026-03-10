import { createEffect, createMemo, createSignal, onCleanup, Show } from 'solid-js';

import { createTranslator } from '@/src/shared/i18n';
import { messaging } from '@/src/shared/messaging';
import type { BookmarkSuggestionUpdatePayload, Locale } from '@/src/shared/types';

type Props = {
  payload: BookmarkSuggestionUpdatePayload;
  locale: Locale;
  requestRemove: () => void;
};

const EXIT_ANIMATION_MS = 240;
const ERROR_AUTO_CLOSE_MS = 4000;

export function BookmarkSuggestionPill(props: Props) {
  const [exiting, setExiting] = createSignal(false);
  const [secondsLeft, setSecondsLeft] = createSignal<number>(0);
  const [countdownProgress, setCountdownProgress] = createSignal<number>(0);

  const kind = createMemo(() => props.payload.kind);
  const isLoading = createMemo(() => kind() === 'loading');
  const isReady = createMemo(() => kind() === 'ready');
  const isError = createMemo(() => kind() === 'error');
  const readyPayload = createMemo(() =>
    props.payload.kind === 'ready' ? props.payload : null,
  );
  const errorPayload = createMemo(() =>
    props.payload.kind === 'error' ? props.payload : null,
  );
  const canOpenOptions = createMemo(() => {
    const payload = errorPayload();
    return payload?.canOpenOptions ?? false;
  });
  const translator = createMemo(() => createTranslator(props.locale));

  const confidencePercent = createMemo(() => {
    const payload = readyPayload();
    if (!payload) return null;
    return Math.round(payload.suggestion.confidence * 100);
  });

  const confidenceClass = createMemo(() => {
    const percent = confidencePercent();
    if (percent == null) return 'bg-yellow-100 text-yellow-700';
    if (percent >= 80) return 'bg-emerald-100 text-emerald-700';
    if (percent >= 50) return 'bg-sky-100 text-sky-700';
    return 'bg-amber-100 text-amber-700';
  });

  const closeWithAnimation = (after?: () => void) => {
    if (exiting()) return;
    setExiting(true);
    window.setTimeout(() => {
      after?.();
      props.requestRemove();
    }, EXIT_ANIMATION_MS);
  };

  const handleAccept = () => {
    const payload = readyPayload();
    if (!payload) return;
    closeWithAnimation(() => {
      void messaging.sendMessage('applyBookmarkSuggestion', {
        bookmarkId: payload.bookmarkId,
        suggestedFolder: payload.suggestion.suggestedFolder,
        title: payload.suggestion.title,
      });
    });
  };

  const handleReject = () => {
    const bookmarkId = props.payload.bookmarkId;
    closeWithAnimation(() => {
      void messaging.sendMessage('rejectBookmarkSuggestion', { bookmarkId });
    });
  };

  const handleOpenOptions = () => {
    void messaging.sendMessage('openOptions');
  };

  createEffect(() => {
    if (!isReady()) return;
    if (props.payload.kind !== 'ready') return;

    if (!props.payload.ui.autoAcceptEnabled) return;
    const total = Math.max(0, Math.trunc(props.payload.ui.autoAcceptSeconds));
    if (total <= 0) return;

    setSecondsLeft(total);
    setCountdownProgress(100);

    const startTime = Date.now();
    const timeoutId = window.setTimeout(handleAccept, total * 1000);
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
  });

  createEffect(() => {
    if (!isError()) return;
    const timerId = window.setTimeout(handleReject, ERROR_AUTO_CLOSE_MS);
    onCleanup(() => window.clearTimeout(timerId));
  });

  return (
    <div class="pointer-events-auto">
      <div
        class={[
          'flex items-center gap-3 rounded-full border border-slate-100 bg-white px-4 py-3 font-sans shadow-md',
          exiting() ? 'flowmark-animate-out' : 'flowmark-animate-in',
          isError() ? 'flowmark-error-state' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          class={[
            'flex h-10 w-10 flex-none items-center justify-center rounded-full',
            isError() ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600',
          ].join(' ')}
        >
          <Show when={!isLoading() && !isError()}>
            <BookmarkIcon />
          </Show>
          <Show when={isLoading() && !isError()}>
            <LoadingIcon />
          </Show>
          <Show when={isError()}>
            <ErrorIcon />
          </Show>
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 overflow-visible">
            <Show when={!isError()}>
              <FolderIcon />
            </Show>
            <Show when={readyPayload()}>
              {(payload) => (
                <span class="truncate text-sm font-medium text-slate-800">
                  {payload().suggestion.suggestedFolder || translator().t('common.bookmarksBar')}
                </span>
              )}
            </Show>
            <Show when={props.payload.kind === 'loading'}>
              <span class="truncate text-sm font-medium text-slate-800">
                {translator().t('content.smartRecommendation')}
              </span>
            </Show>
            <Show when={errorPayload()}>
              {(payload) => (
                <span class="truncate text-sm font-medium text-red-700">{payload().message}</span>
              )}
            </Show>
            <Show when={readyPayload()}>
              <span class={`flex-none rounded-sm px-1.5 py-0.5 text-xs font-medium ${confidenceClass()}`}>
                {confidencePercent()}%
              </span>
            </Show>
          </div>

          <div class="mt-0.5 truncate text-sm text-slate-500" title={props.payload.title}>
            <Show when={!isError()}>
              {props.payload.title || translator().t('common.untitled')}
            </Show>
            <Show when={isError()}>
              <span class="text-red-500">{translator().t('content.tryBookmarkingAgain')}</span>
            </Show>
          </div>
        </div>

        <div class="flex flex-none items-center gap-2">
          <Show when={props.payload.kind === 'ready'}>
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200"
              title={translator().t('content.reject')}
              onClick={handleReject}
            >
              <XIcon />
            </button>
            <button
              type="button"
              class="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
              title={translator().t('content.accept')}
              onClick={handleAccept}
            >
              <Show
                when={
                  props.payload.ui.autoAcceptEnabled &&
                  Math.trunc(props.payload.ui.autoAcceptSeconds) > 0
                }
                fallback={<CheckIcon />}
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
              </Show>
            </button>
          </Show>

          <Show when={canOpenOptions()}>
            <button
              type="button"
              class="flex h-8 items-center justify-center rounded-full bg-slate-100 px-3 text-xs font-medium text-slate-700 hover:bg-slate-200"
              onClick={handleOpenOptions}
            >
              {translator().t('content.openSettings')}
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="flex-none text-slate-600"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
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
      <path
        class="flowmark-bookmark-path"
        d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
        stroke="url(#flowmarkGradient)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        class="flowmark-bookmark-pulse"
        d="M9 9h6M9 13h3"
        stroke="url(#flowmarkGradient)"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="flowmark-error-icon"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
