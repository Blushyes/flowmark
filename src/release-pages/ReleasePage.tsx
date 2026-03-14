import type { JSX } from 'solid-js';
import { createEffect, createMemo, createSignal, onMount, Show } from 'solid-js';

import { Button } from '@/src/components/Button';
import { StatusBadge } from '@/src/components/StatusBadge';
import { getBrowserUiLanguage, resolveLocale } from '@/src/shared/i18n';
import { openSettingsPage } from '@/src/shared/open-settings-page';
import {
  getReleasePageContent,
  RELEASE_META,
  type ReleasePageAction,
  type ReleasePageKind,
} from '@/src/shared/release-pages';
import { getSettings } from '@/src/shared/settings';
import type { FlowmarkSettings } from '@/src/shared/types';

type Props = {
  pageKind: ReleasePageKind;
  installAddon?: JSX.Element;
};

export function ReleasePage(props: Props) {
  const [settings, setSettings] = createSignal<FlowmarkSettings | null>(null);

  const locale = createMemo(() =>
    resolveLocale(settings()?.localeOverride ?? 'auto', getBrowserUiLanguage()),
  );
  const content = createMemo(() => getReleasePageContent(locale(), props.pageKind));

  createEffect(() => {
    document.title = content().documentTitle;
  });

  onMount(() => {
    void (async () => {
      const current = await getSettings();
      setSettings(current);
    })();
  });

  const runAction = (action: ReleasePageAction) => {
    switch (action) {
      case 'settings':
        void openSettingsPage();
        return;
      case 'github':
        void browser.tabs.create({ url: RELEASE_META.githubUrl });
        return;
      case 'chrome-store':
        void browser.tabs.create({ url: RELEASE_META.chromeWebStoreUrl });
    }
  };

  return (
    <div class="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div class="mx-auto max-w-5xl">
        <header class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex min-w-0 items-center gap-3">
            <img src="/icon/48.png" alt="FlowMark" class="h-12 w-12 shrink-0 bg-transparent" />
            <div class="min-w-0">
              <div class="text-lg font-semibold tracking-[-0.02em] text-slate-950">FlowMark</div>
              <div class="text-sm text-slate-600">{content().brandTagline}</div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            {content().badges.map((badge, index) => (
              <StatusBadge tone={index === 0 ? 'ready' : 'neutral'}>
                {badge}
              </StatusBadge>
            ))}
          </div>
        </header>

        <div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
          <section class="rounded-[32px] border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8 sm:py-8">
            <div class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              {content().eyebrow}
            </div>
            <h1 class="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.7rem] sm:leading-[1.05]">
              {content().headline}
            </h1>
            <p class="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-[15px]">
              {content().description}
            </p>

            <div class="mt-7 flex flex-wrap gap-3">
              <Button type="button" onClick={() => runAction('settings')}>
                {content().primaryActionLabel}
              </Button>
              <Button
                type="button"
                variant="secondary"
                class="gap-2"
                onClick={() => runAction('github')}
              >
                <GitHubIcon class="h-4 w-4" />
                {content().secondaryActionLabel}
              </Button>
            </div>
          </section>

          <aside class="space-y-4">
            <Show when={content().versionItems.length > 0}>
              <section class="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
                <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {content().versionSectionTitle}
                </div>
                <div class="mt-4 space-y-3">
                  {content().versionItems.map((item) => (
                    <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div class="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                        {item.label}
                      </div>
                      <div class="mt-1 text-sm font-semibold text-slate-950">{item.value}</div>
                    </div>
                  ))}
                </div>
              </section>
            </Show>

            {content().infoCards.map((card) => (
              <section class="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
                <div class="text-sm font-semibold tracking-[-0.01em] text-slate-950">
                  {card.title}
                </div>
                <p class="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
                <Show when={card.action}>
                  {(action) => (
                    <button
                      type="button"
                      class="mt-4 inline-flex items-center rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70"
                      onClick={() => runAction(action().target)}
                    >
                      {action().label}
                    </button>
                  )}
                </Show>
              </section>
            ))}
          </aside>
        </div>

        <section class="mt-6 rounded-[32px] border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8 sm:py-8">
          <Show when={props.pageKind === 'install' && content().setupSteps?.length}>
            <div class="mb-8 rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-5 sm:px-6 sm:py-6">
              <div class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {content().setupSectionTitle}
              </div>
              <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                {content().setupSectionDescription}
              </p>

              <div class="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                <div class="space-y-3">
                  {content().setupSteps?.map((step, index) => (
                    <article class="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                      <div class="flex items-start gap-3">
                        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                          {index + 1}
                        </div>
                        <div>
                          <div class="text-sm font-semibold tracking-[-0.01em] text-slate-950">
                            {step.title}
                          </div>
                          <p class="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div class="space-y-3">
                  {content().setupFieldHints?.map((field) => (
                    <article class="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                      <div class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {field.label}
                      </div>
                      <div class="mt-2 rounded-2xl bg-slate-900 px-3 py-2 text-sm font-medium text-white">
                        {field.value}
                      </div>
                      <p class="mt-3 text-sm leading-6 text-slate-600">{field.description}</p>
                    </article>
                  ))}
                </div>
              </div>

              <Show when={content().setupSaveNotes?.length}>
                <div class="mt-6 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                  <div class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {content().setupSaveNotesTitle}
                  </div>
                  <div class="mt-3 space-y-2">
                    {content().setupSaveNotes?.map((note) => (
                      <div class="flex items-start gap-2 text-sm leading-6 text-slate-600">
                        <div class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Show>

              <Show when={props.pageKind === 'install' && props.installAddon}>
                <div class="mt-6">{props.installAddon}</div>
              </Show>
            </div>
          </Show>

          <div class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {content().featureSectionTitle}
          </div>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            {content().featureSectionDescription}
          </p>

          <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {content().features.map((feature) => (
              <article class="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div class="text-sm font-semibold tracking-[-0.01em] text-slate-950">
                  {feature.title}
                </div>
                <p class="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function GitHubIcon(props: { class?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      class={props.class}
    >
      <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.88-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.05A9.33 9.33 0 0 1 12 6.84c.85 0 1.71.12 2.5.35 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.46.1 2.72.64.72 1.03 1.63 1.03 2.75 0 3.94-2.35 4.8-4.58 5.06.36.32.68.95.68 1.91 0 1.38-.01 2.49-.01 2.83 0 .27.18.59.69.49A10.27 10.27 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
    </svg>
  );
}
