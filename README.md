# FlowMark

[中文](./README.zh-CN.md)

FlowMark is a browser extension that recommends a better bookmark folder and title right after you save a page.

## Highlights

- Built with `WXT`, `SolidJS`, and `Tailwind CSS v4`
- Shadow DOM floating pill UI on the page
- Typed messaging via `@webext-core/messaging`
- Works with any OpenAI-compatible endpoint through Vercel AI SDK
- English and Simplified Chinese UI

## How it works

After you create a bookmark, FlowMark:

1. confirms the bookmark still exists
2. reads lightweight page context from the active tab
3. asks the configured AI model for a folder, title, and confidence score
4. shows a top-right floating pill
5. lets you accept, reject, or auto-apply after a countdown

Default behavior:

- recommendation: on
- auto-accept: on
- auto-accept delay: `5s`
- send full page text: off
- max page text: `5000` chars
- language: follow browser UI language

## Chrome Web Store

Current store listing: [https://chromewebstore.google.com/detail/kbmjedeepcglnmllaklecppgijhgggdg?utm_source=item-share-cb](https://chromewebstore.google.com/detail/kbmjedeepcglnmllaklecppgijhgggdg?utm_source=item-share-cb)

Note:
- the current Chrome Web Store listing is still the previous legacy version
- this open-source edition will be submitted for review later

## Development

```bash
pnpm install
pnpm dev
```

Other commands:

```bash
pnpm compile
pnpm build
pnpm zip
pnpm dev:firefox
pnpm build:firefox
pnpm zip:firefox
```

## Setup

1. Open the FlowMark popup.
2. Open `Settings`.
3. Fill in `Base URL`, `Model`, and optionally `API Key`.
4. Save settings.
5. Grant host permission for the AI endpoint origin.

Examples:

- `https://api.openai.com/v1`
- `http://localhost:11434/v1`

## Permissions

Required:

- `bookmarks`
- `storage`
- `tabs`

Optional host permissions:

- `https://*/*`
- `http://*/*`

## Status

Implemented:

- smart bookmark recommendation
- folder + title suggestion
- accept / reject / auto-accept flow
- popup + settings page
- `en` / `zh-CN` i18n
