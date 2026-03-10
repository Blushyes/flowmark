export async function openSettingsPage(): Promise<void> {
  const url = browser.runtime.getURL('/options.html');
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
