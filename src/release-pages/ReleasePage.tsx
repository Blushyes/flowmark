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
    <div class="min-h-screen bg-[#fcfcfc] px-5 py-8 text-neutral-900 sm:px-6 sm:py-12">
      <div class="mx-auto max-w-4xl">
        <header class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex min-w-0 items-center gap-3">
            <img src="/icon/48.png" alt="FlowMark" class="h-10 w-10 shrink-0 bg-transparent" />
            <div class="min-w-0">
              <div class="text-base font-medium tracking-tight text-neutral-900">FlowMark</div>
              <div class="text-sm text-neutral-500">{content().brandTagline}</div>
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

        <div class="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
          <section class="border-b border-neutral-200 pb-10">
            <div class="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
              {content().eyebrow}
            </div>
            <h1 class="mt-3 max-w-3xl text-3xl font-medium tracking-tight text-neutral-900 sm:text-[3.2rem] sm:leading-[1.08]">
              {content().headline}
            </h1>
            <p class="mt-5 max-w-2xl text-base leading-8 text-neutral-500">
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
              <section class="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div class="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                  {content().versionSectionTitle}
                </div>
                <div class="mt-4 space-y-3">
                  {content().versionItems.map((item) => (
                    <div class="border-t border-neutral-200 pt-3 first:border-t-0 first:pt-0">
                      <div class="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                        {item.label}
                      </div>
                      <div class="mt-1 text-sm font-medium text-neutral-900">{item.value}</div>
                    </div>
                  ))}
                </div>
              </section>
            </Show>

            {content().infoCards.map((card) => (
              <section class="rounded-xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div class="text-sm font-medium tracking-tight text-neutral-900">
                  {card.title}
                </div>
                <p class="mt-2 text-sm leading-6 text-neutral-500">{card.body}</p>
                <Show when={card.action}>
                  {(action) => (
                    <button
                      type="button"
                      class="mt-4 inline-flex items-center rounded-md border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-neutral-900/10"
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

        <section class="mt-10 border-t border-neutral-200 pt-10">
          <Show when={props.pageKind === 'install' && content().setupSteps?.length}>
            <div class="mb-10 rounded-xl border border-neutral-200 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:px-6 sm:py-6">
              <div class="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                {content().setupSectionTitle}
              </div>
              <p class="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">
                {content().setupSectionDescription}
              </p>

              <div class="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                <div class="space-y-3">
                  {content().setupSteps?.map((step, index) => (
                    <article class="rounded-lg border border-neutral-200 bg-[#fafafa] px-4 py-4">
                      <div class="flex items-start gap-3">
                        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-medium text-white">
                          {index + 1}
                        </div>
                        <div>
                          <div class="text-sm font-medium tracking-tight text-neutral-900">
                            {step.title}
                          </div>
                          <p class="mt-2 text-sm leading-6 text-neutral-500">{step.body}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div class="space-y-3">
                  {content().setupFieldHints?.map((field) => (
                    <article class="rounded-lg border border-neutral-200 bg-[#fafafa] px-4 py-4">
                      <div class="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                        {field.label}
                      </div>
                      <div class="mt-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-900">
                        {field.value}
                      </div>
                      <p class="mt-3 text-sm leading-6 text-neutral-500">{field.description}</p>
                    </article>
                  ))}
                </div>
              </div>

              <Show when={content().setupSaveNotes?.length}>
                <div class="mt-6 rounded-lg border border-neutral-200 bg-[#fafafa] px-4 py-4">
                  <div class="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                    {content().setupSaveNotesTitle}
                  </div>
                  <div class="mt-3 space-y-2">
                    {content().setupSaveNotes?.map((note) => (
                      <div class="flex items-start gap-2 text-sm leading-6 text-neutral-500">
                        <div class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
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

          <div class="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
            {content().featureSectionTitle}
          </div>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">
            {content().featureSectionDescription}
          </p>

          <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {content().features.map((feature) => (
              <article class="rounded-lg border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div class="text-sm font-medium tracking-tight text-neutral-900">
                  {feature.title}
                </div>
                <p class="mt-2 text-sm leading-6 text-neutral-500">{feature.description}</p>
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
