// #30 — corpus مشترک تست امنیتی (بر پایهٔ OWASP XSS Cheat Sheet + mXSS + CSS injection).
// Plain JS module تا هم unit test (vitest) و هم fixture مرورگر (e2e) همان
// شاهد را اجرا کنند. قرارداد: هر payload موفق `window.__ZENITH_XSS_EXEC__()`
// را صدا می‌زند؛ اگر پس از sanitize+inject شمارنده صفر بماند، یعنی هیچ
// payload شناخته‌شده‌ای اجرا نشده است.
const E = 'window.__ZENITH_XSS_EXEC__()';
const S = (inner) => '<scr' + 'ipt>' + inner + '</scr' + 'ipt>';

export const XSS_CORPUS = [
  // ── basics ──
  { name: 'script tag', html: S(E) },
  { name: 'script src js', html: '<script src="javascript:alert(1)"></script>' },
  { name: 'img onerror', html: `<img src="x" onerror="${E}">` },
  { name: 'svg onload', html: `<svg onload="${E}"></svg>` },
  { name: 'body onload', html: `<body onload="${E}">` },
  { name: 'iframe js', html: `<iframe src="javascript:${E}"></iframe>` },
  { name: 'a js lower', html: `<a href="javascript:${E}">x</a>` },
  { name: 'a js mixedcase', html: `<a href="JaVaScRiPt:${E}">x</a>` },
  { name: 'a js tab', html: `<a href="java\tscript:${E}">x</a>` },
  { name: 'a js entity', html: `<a href="&#106;avascript:${E}">x</a>` },
  { name: 'object data', html: `<object data="javascript:${E}"></object>` },
  { name: 'embed src', html: `<embed src="javascript:${E}">` },
  { name: 'form action', html: `<form action="javascript:${E}"><input></form>` },
  { name: 'input formaction', html: `<input type="submit" formaction="javascript:${E}">` },
  { name: 'meta refresh', html: `<meta http-equiv="refresh" content="0;url=javascript:${E}">` },
  { name: 'base href', html: `<base href="javascript:${E}/">` },
  { name: 'video source onerror', html: `<video><source onerror="${E}"></video>` },
  { name: 'details ontoggle', html: `<details open ontoggle="${E}"></details>` },
  { name: 'marquee onstart', html: `<marquee onstart="${E}"></marquee>` },
  { name: 'img src js', html: `<img src="javascript:${E}">` },
  { name: 'srcset second url', html: `<img srcset="/a.jpg, javascript:${E}">` },
  { name: 'style expression', html: `<div style="width: expression(${E})">x</div>` },
  { name: 'style url js', html: `<div style="background:url(javascript:${E})">x</div>` },
  { name: 'style import', html: '<div style="@import \'evil.css\'">x</div>' },
  { name: 'style binding', html: `<div style="-moz-binding:url(${E})">x</div>` },
  { name: 'upper event attr', html: `<img src=x ONERROR="${E}">` },
  { name: 'noscript fallback', html: `<noscript><p title="</noscript><img src=x onerror=${E}>` },
  { name: 'xml cdata', html: '<xml>' + S(E) + '</xml>' },
  { name: 'link import data', html: '<link rel="import" href="data:text/html,' + S(E) + '">' },

  // ── mXSS (template/svg/math/noscript mutation) ──
  { name: 'template script', html: '<template>' + S(E) + '</template>' },
  { name: 'svg style wrapper', html: `<svg><style><img src=x onerror="${E}"></style></svg>` },
  {
    name: 'math mtext wrapper',
    html: `<math><mtext><style><img src=x onerror="${E}"></style></mtext></math>`,
  },
  {
    name: 'foreignObject',
    html: `<svg><foreignObject><div><img src=x onerror="${E}"></div></foreignObject></svg>`,
  },
  {
    name: 'svg set animate',
    html: `<svg><a xlink:href="safe"><set attributeName="xlink:href" to="javascript:${E}"/></a></svg>`,
  },
  {
    name: 'svg use',
    html: '<svg><use href="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+#x"></use></svg>',
  },
  { name: 'frameset', html: `<frameset onload="${E}"></frameset>` },

  // ── data: URLs ──
  {
    name: 'iframe data b64',
    html: '<iframe src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="></iframe>',
  },
  { name: 'a data svg', html: `<a href="data:image/svg+xml,<svg onload=${E}></svg>">x</a>` },

  // ── attribute weirdness ──
  { name: 'spacey event attr', html: `<div onclick = "${E}">x</div>` },
  { name: 'proto attr name', html: '<div __proto__="x">y</div>' },
  { name: 'constructor attr', html: '<div constructor="x">y</div>' },
];

/** payload‌هایی که باید در خروجی sanitizeCSS باقی نمانند/خنثی شوند. */
export const CSS_CORPUS = [
  { name: 'expression', css: `width: expression(${E})`, banned: /expression/i },
  { name: 'js url', css: `background: url(javascript:${E})`, banned: /javascript\s*:/i },
  { name: 'import', css: "@import url('evil.css')", banned: /@import/i },
  { name: 'behavior', css: 'behavior: url(#default#x)', banned: /behavior\s*:/i },
  { name: 'moz-binding', css: `-moz-binding: url(x.xml)`, banned: /-moz-binding/i },
  { name: 'benign color', css: 'color: red', banned: null },
  { name: 'benign url', css: 'background: url(/ok.png)', banned: null },
];
