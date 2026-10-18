import { EVENT_ATTR_REGEX, DANGEROUS_PROTOCOLS, FORBIDDEN_ATTR_NAMES } from './html-policy';
/** @internal */
export function isAttributeDangerous(attrName: string, attrValue: string, el?: Element): boolean {
  const lowerName = attrName.toLowerCase();

  // ── ۱. Event handler ها (onclick, onerror, …) ──
  if (EVENT_ATTR_REGEX.test(lowerName)) {
    return true;
  }

  // ── ۲. Prototype Pollution در attribute name ──
  if (FORBIDDEN_ATTR_NAMES.some((name) => lowerName.includes(name))) {
    return true;
  }

  // ── ۳. پروتکل‌های خطرناک در URL-bearing attribute ها ──
  // FIX (v1.2.3): srcset، cite، poster، background هم به لیست اضافه شدند.
  // قبلاً فقط href، src، action، formaction، xlink:href، data چک می‌شدند.
  // srcset می‌تواند حاوی URL با javascript: باشد، cite برای <blockquote>/<q>/<del>/<ins>،
  // poster برای <video>، background برای <body>/<table> (deprecated ولی فعال).
  if (
    lowerName === 'href' ||
    lowerName === 'src' ||
    lowerName === 'action' ||
    lowerName === 'formaction' ||
    lowerName === 'xlink:href' ||
    lowerName === 'data' ||
    lowerName === 'srcset' ||
    lowerName === 'cite' ||
    lowerName === 'poster' ||
    lowerName === 'background'
  ) {
    // FIX (v1.2.3): اجازه‌ی `data:image/...` برای src روی <img> و <source>.
    // قبلاً هر data: URL بلاک می‌شد، در نتیجه inline image‌های base64 از کار
    // می‌افتادند. حالا data:image/ برای این دو تگ مجاز است (چون اجرای اسکریپت
    // در data:image/ ممکن نیست).
    if (lowerName === 'src' && el) {
      const tag = el.tagName.toUpperCase();
      if (tag === 'IMG' || tag === 'SOURCE') {
        if (isDataImage(attrValue)) return false;
      }
    }
    // SEC FIX (v1.2.6): SEC-A4 — srcset is a comma-separated list of
    // "<url> <descriptor>" pairs. A naive hasDangerousProtocol(attrValue) call
    // only inspects the very start of the whole string, so the second URL in
    //   "/a.jpg, javascript:alert(1)"
    // would slip through. Split on commas and check every URL individually.
    if (lowerName === 'srcset') {
      const candidates = String(attrValue || '').split(',');
      for (const candidate of candidates) {
        // srcset descriptor syntax: "<url> <width-or-density>". Trim the
        // trailing descriptor (everything after the first whitespace) before
        // handing the URL to hasDangerousProtocol so whitespace inside the
        // URL itself isn't double-handled.
        const urlPart = candidate.trim().split(/\s+/)[0] ?? '';
        if (hasDangerousProtocol(urlPart)) {
          return true;
        }
      }
    } else if (hasDangerousProtocol(attrValue)) {
      return true;
    }
  }

  // ── ۴. style attribute با payloads خطرناک ──
  // CSS می‌تواند حاوی expression() (در IE) یا url(javascript:) باشد.
  if (lowerName === 'style') {
    const lowerValue = attrValue.toLowerCase();
    // SEC FIX (v1.2.6): SEC-A3 — fix operator-precedence bug. The previous
    // expression was:
    //   lowerValue.includes('url(') && lowerValue.includes('vbscript:')
    // which (because && binds tighter than ||) was parsed as
    //   expression( || javascript: || (url( && vbscript:))
    // meaning `vbscript:` was only blocked when `url(` also appeared. A bare
    // `vbscript:alert(1)` or any other vbscript usage slipped through. We now
    // also block `vbscript:` unconditionally and add three more CSS-based
    // vectors: -moz-binding (XBL in old Firefox), behavior: (IE htc files),
    // and @import (loads an external stylesheet that can carry data: or
    // expression() payloads).
    if (
      lowerValue.includes('expression(') ||
      lowerValue.includes('javascript:') ||
      lowerValue.includes('vbscript:') ||
      lowerValue.includes('-moz-binding') ||
      lowerValue.includes('behavior:') ||
      lowerValue.includes('@import')
    ) {
      return true;
    }
  }

  return false;
}

function isDataImage(value: string): boolean {
  if (!value) return false;
  const trimmed = value.replace(/^[\s\x00-\x20]+/, '').toLowerCase();
  return trimmed.startsWith('data:image/');
}

function hasDangerousProtocol(value: string): boolean {
  if (!value) return false;

  // حذف فضای خالی و کاراکترهای کنترلی از ابتدا.
  // نکته: فقط ابتدا را trim می‌کنیم چون هکر می‌نویسد `  javascript:alert(1)`.
  const trimmed = value.replace(/^[\s\x00-\x20]+/, '').toLowerCase();

  // حذف فضای خالی داخلی هم (چون هکر می‌نویسد `java script:` یا `java\tscript:`).
  const noWhitespace = trimmed.replace(/[\s\x00-\x20]+/g, '');

  // بررسی پروتکل‌های خطرناک.
  return DANGEROUS_PROTOCOLS.some((protocol) => noWhitespace.startsWith(protocol));
}
