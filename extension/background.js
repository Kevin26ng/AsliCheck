/* background.js — AsliCheck service worker: context menu + message relay */

// Create right-click context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'aslicheck-verify',
    title: 'Verify with AsliCheck',
    contexts: ['selection'],
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'aslicheck-verify' && info.selectionText && tab?.id) {
    // Try sending to content script (in-page overlay)
    chrome.tabs.sendMessage(tab.id, {
      action: 'verify',
      text: info.selectionText.trim(),
    }).catch(() => {
      // Content script not loaded (e.g. chrome:// pages) — open popup instead
      chrome.storage.local.set({ pendingClaim: info.selectionText.trim() });
      chrome.action.openPopup();
    });
  }
});
