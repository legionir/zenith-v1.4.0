// devtools-panel.js — ایجاد یک panel اختصاصی در Chrome DevTools.
//
// این فایل یک tab "Zenith" در Chrome DevTools ایجاد می‌کند.
// وقتی کاربر روی آن کلیک کند، popup.html (با تمام 4 panel) نمایش داده می‌شود.

chrome.devtools.panels.create(
  'Zenith',
  null,
  'popup.html',
  function (panel) {
    console.log('[Zenith DevTools] Panel created successfully.');
  }
);
