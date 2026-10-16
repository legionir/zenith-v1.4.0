// background.js — Service worker for Zenith DevTools Extension.
// BUG-DEVTEXT-01 / BUG-DEVTEXT-08 / IMP-DEVTEXT-05 (#8):
// دسترسی دامنه از طریق activeTab + optional_host_permissions (با تأیید کاربر) انجام می‌شود
// و manifest.json یک JSON استاندارد بدون کامنت است.
//
// #67 (SEC): هر پیامی که به این worker می‌رسد از یک منبع غیرقابل‌اعتماد می‌آید
// (هر script داخل صفحهٔ بازدید‌شده می‌تواند `chrome.runtime.sendMessage` صدا بزند).
// پس: (۱) `sender.id` باید همان id همین افزونه باشد، (۲) پیام باید دقیقاً با
// schema بخواند، (۳) پیام نامعتبر **نادیده** گرفته می‌شود (بدون throw/console).

self.importScripts('message-schema.js');

const schema = globalThis.ZenithDevtoolsSchema;
if (!schema) {
  throw new Error('[Zenith DevTools] message-schema.js must be loaded before background.js');
}

// نصب extension.
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Zenith DevTools] Extension installed.');
});

// ایجاد DevTools panel.
chrome.devtools.panels.create(
  'Zenith',
  null, // icon (از default استفاده می‌کند)
  'popup.html',
  (_panel) => {
    console.log('[Zenith DevTools] DevTools panel created.');
  },
);

// گوش دادن به پیام‌های از content script.
//
// NOTE (icons): No `iconUrl` is passed to chrome.notifications.create so the
// extension loads cleanly without an `icons/` folder. Chrome falls back to a
// default notification icon. To restore a branded icon later, drop PNGs into
// `icons/` (icon16.png, icon48.png, icon128.png), add an `"icons"` field to
// manifest.json, and pass `iconUrl: 'icons/icon48.png'` here.
chrome.runtime.onMessage.addListener((message, sender, _sendResponse) => {
  // #67: فقط پیام‌های همین افزونه و فقط با schema شناخته‌شده.
  if (!schema.isTrustedSender(sender, chrome.runtime.id)) return undefined;

  const notification = schema.validateNotification(message);
  if (!notification) return undefined; // پیام نامعتبر/schema ناخوانا ⇒ نادیده

  // نمایش notification برای state changes مهم.
  chrome.notifications.create({
    type: 'basic',
    title: 'Zenith DevTools',
    message: notification.text,
  });
  return true;
});
