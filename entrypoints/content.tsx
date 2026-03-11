import type { ContentScriptContext } from '#imports';
import { createSignal, Show } from 'solid-js';
import { render } from 'solid-js/web';

import '~/assets/content-ui.css';

import { BookmarkSuggestionPill } from '@/src/content/BookmarkSuggestionPill';
import { getCurrentLocale } from '@/src/shared/i18n';
import { messaging } from '@/src/shared/messaging';
import type {
  BookmarkSuggestionUpdatePayload,
  GetPageContentRequest,
  Locale,
  PageContent,
} from '@/src/shared/types';

const [payload, setPayload] = createSignal<BookmarkSuggestionUpdatePayload | null>(null);
const [locale, setLocale] = createSignal<Locale>('en');

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_start',
  cssInjectionMode: 'ui',
  async main(ctx: ContentScriptContext) {
    let ui:
      | {
          mount: () => void;
          remove: () => void;
          shadowHost: HTMLElement;
        }
      | undefined;
    let isMounted = false;

    const requestRemove = () => {
      setPayload(null);
      if (!ui || !isMounted) return;
      isMounted = false;
      ui.remove();
    };

    const ensureUi = async () => {
      if (ui) return ui;

      const instance = await createShadowRootUi(ctx, {
        name: 'flowmark-bookmark-ui',
        position: 'inline',
        anchor: 'body',
        append: 'last',
        onMount: (uiContainer, _shadow, shadowHost) => {
          styleHost(shadowHost);
          return render(
            () => (
              <div
                class="pointer-events-none"
                style={{
                  position: 'fixed',
                  top: '20px',
                  right: '20px',
                  'z-index': 2147483647,
                }}
              >
                <Show when={payload()}>
                  {(currentPayload) => (
                    <BookmarkSuggestionPill
                      payload={currentPayload()}
                      locale={locale()}
                      requestRemove={requestRemove}
                    />
                  )}
                </Show>
              </div>
            ),
            uiContainer,
          );
        },
        onRemove: (dispose) => dispose?.(),
      });

      ui = instance;
      return instance;
    };

    messaging.onMessage('bookmarkSuggestionUpdate', ({ data }) => {
      void (async () => {
        setLocale(await getCurrentLocale());
        setPayload(data);
        await waitForBody();
        const instance = await ensureUi();
        if (!isMounted) {
          instance.mount();
          isMounted = true;
        }
      })();
    });

    messaging.onMessage('getPageContent', ({ data }) => {
      return getPageContent(data);
    });
  },
});

function styleHost(shadowHost: HTMLElement) {
  shadowHost.style.setProperty('position', 'fixed', 'important');
  shadowHost.style.setProperty('top', '20px', 'important');
  shadowHost.style.setProperty('right', '20px', 'important');
  shadowHost.style.setProperty('left', 'auto', 'important');
  shadowHost.style.setProperty('bottom', 'auto', 'important');
  shadowHost.style.setProperty('z-index', '2147483647', 'important');
}

async function waitForBody(timeoutMs = 8000): Promise<void> {
  if (document.body) return;

  const start = Date.now();
  await new Promise<void>((resolve) => {
    const id = window.setInterval(() => {
      if (document.body) {
        window.clearInterval(id);
        resolve();
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        window.clearInterval(id);
        resolve();
      }
    }, 50);
  });
}

function getPageContent(request: GetPageContentRequest): PageContent {
  const url = window.location.href;
  const title = document.title || '';
  const description =
    document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? '';

  const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map((heading) => heading.textContent?.trim() ?? '')
    .filter((text) => text.length > 0)
    .slice(0, 8);

  const includeText = Boolean(request.includeText);
  const maxChars = Math.max(0, Math.trunc(request.maxChars));
  const text = includeText ? truncateText(document.body?.innerText?.trim() ?? '', maxChars) : null;

  const hasPasswordField = Boolean(document.querySelector('input[type="password"]'));
  const formFieldCount = document.querySelectorAll('input:not([type="hidden"]), textarea, select').length;
  const linkCount = document.querySelectorAll('a[href]').length;

  return {
    url,
    title,
    description,
    headings,
    text: text && text.length > 0 ? text : null,
    hasPasswordField,
    formFieldCount,
    linkCount,
  };
}

function truncateText(text: string, maxChars: number): string {
  if (maxChars <= 0) return '';
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}
