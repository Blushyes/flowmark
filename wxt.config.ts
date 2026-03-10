import { resolve } from 'node:path';

import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-solid'],
  webExt: {
    chromiumProfile: resolve('.wxt/chromium-profile'),
    keepProfileChanges: true,
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Flowmark',
    short_name: 'Flowmark',
    description: 'Smart bookmark recommendations after you save a page.',
    permissions: ['bookmarks', 'storage', 'tabs'],
    optional_host_permissions: ['https://*/*', 'http://*/*'],
  },
});
