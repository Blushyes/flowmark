import { shouldAutoOpenUpdatePage } from '@/src/shared/release-pages';

const INSTALL_PAGE_PATH = '/install.html';
const UPDATE_PAGE_PATH = '/update.html';

export function initLifecyclePages(): void {
  browser.runtime.onInstalled.addListener((details) => {
    if (import.meta.env.DEV) return;

    if (details.reason === 'install') {
      void openLifecyclePage(INSTALL_PAGE_PATH);
      return;
    }

    if (details.reason !== 'update') return;

    const currentVersion = browser.runtime.getManifest().version;
    if (!shouldAutoOpenUpdatePage(currentVersion, details.previousVersion)) return;
    void openLifecyclePage(UPDATE_PAGE_PATH);
  });
}

async function openLifecyclePage(
  path: typeof INSTALL_PAGE_PATH | typeof UPDATE_PAGE_PATH,
): Promise<void> {
  const url = browser.runtime.getURL(path);
  const existingTabs = await browser.tabs.query({ url });
  const existingTab = existingTabs.find((tab) => tab.id != null);

  if (existingTab?.id != null) {
    await browser.tabs.update(existingTab.id, { active: true });
    if (existingTab.windowId != null) {
      await browser.windows.update(existingTab.windowId, { focused: true });
    }
    return;
  }

  await browser.tabs.create({ url });
}
