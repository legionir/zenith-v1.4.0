// background.js — Service worker for Zenith DevTools Extension.

// نصب extension.
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Zenith DevTools] Extension installed.');
});

// ایجاد DevTools panel.
chrome.devtools.panels.create(
  'Zenith',
  null, // icon (از default استفاده می‌کند)
  'popup.html',
  (panel) => {
    console.log('[Zenith DevTools] DevTools panel created.');
  }
);

// گوش دادن به پیام‌های از content script.
//
// NOTE (icons): No `iconUrl` is passed to chrome.notifications.create so the
// extension loads cleanly without an `icons/` folder. Chrome falls back to a
// default notification icon. To restore a branded icon later, drop PNGs into
// `icons/` (icon16.png, icon48.png, icon128.png), add an `"icons"` field to
// manifest.json, and pass `iconUrl: 'icons/icon48.png'` here.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ZENITH_NOTIFICATION') {
    // نمایش notification برای state changes مهم.
    chrome.notifications.create({
      type: 'basic',
      title: 'Zenith DevTools',
      message: message.text,
    });
  }
  return true;
});
