// packages/ssr/src/server-component-parser.ts
//
// پارس تگ‌ها و resolve props — استخراج مکانیکی از server-component.ts،
// بدون تغییر رفتار (#40).

import { logger } from '@zenith/logger';
import { parseJsonValue } from '@zenith/schema/attr';


// ── TAG PARSER (string-based) ──

/**
 * چون SSR string-based است، از regex برای پیدا کردن تگ‌های
 * <zen-server-component> استفاده می‌کنیم. این ساده‌ترین و سریع‌ترین
 * راه است. در آینده می‌توان از یک HTML parser واقعی استفاده کرد.
 *
 * Regex فقط opening tag را match می‌کند. سپس در کد، برای non-self-closing
 * tagها، closing tag متناظر را پیدا می‌کنیم.
 *
 * گروه‌ها:
 *   $1 = attributeهای داخل تگ (شامل name="..." و prop:foo="...")
 *   $2 = '/' اگر self-closing باشد، در غیر این صورت ''
 */
const OPEN_TAG_REGEX = /<zen-server-component\b([^>]*)>/g;
const CLOSE_TAG_REGEX = /<\/zen-server-component\s*>/g;

export interface FoundTag {
  /** اندیس شروع opening tag در HTML اصلی. */
  start: number;
  /** اندیس پس از پایان closing tag (یا opening tag اگر self-closing). */
  end: number;
  /** رشته‌ی attributeهای داخل opening tag. */
  attrs: string;
  /** محتوای بین opening و closing (فقط برای non-self-closing). */
  inner?: string;
}

/**
 * پیدا کردن تمام تگ‌های <zen-server-component> در HTML.
 *
 * این تابع فقط parse می‌کند — رندر انجام نمی‌دهد.
 *
 * @param html HTML ورودی.
 * @returns لیست تگ‌های پیدا شده، به ترتیب document.
 */
export function findServerComponentTags(html: string): FoundTag[] {
  const results: FoundTag[] = [];
  OPEN_TAG_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OPEN_TAG_REGEX.exec(html)) !== null) {
    const fullMatch = m[0];
    const attrsRaw = m[1] || '';
    const openStart = m.index;
    const openEnd = m.index + fullMatch.length;

    // تشخیص self-closing: اگر attrs با '/' تمام شود.
    const attrsTrimmed = attrsRaw.trim();
    if (attrsTrimmed.endsWith('/')) {
      results.push({
        start: openStart,
        end: openEnd,
        attrs: attrsTrimmed.slice(0, -1),
      });
      continue;
    }

    // پیدا کردن closing tag متناظر (اولین </zen-server-component> بعد از opening).
    CLOSE_TAG_REGEX.lastIndex = openEnd;
    const cm = CLOSE_TAG_REGEX.exec(html);
    if (cm) {
      const closeEnd = cm.index + cm[0].length;
      const inner = html.slice(openEnd, cm.index);
      results.push({
        start: openStart,
        end: closeEnd,
        attrs: attrsRaw,
        inner,
      });
    } else {
      // closing tag وجود ندارد — به‌عنوان self-closing رفتار کن.
      results.push({
        start: openStart,
        end: openEnd,
        attrs: attrsRaw,
      });
    }
  }
  return results;
}

/**
 * Parse کردن attributeهای یک تگ <zen-server-component>.
 *
 * attributeهای با پیشوند `prop:` به props تبدیل می‌شوند.
 * attributeی `name` نام کامپوننت را مشخص می‌کند.
 * سایر attributeها نادیده گرفته می‌شوند.
 *
 * مقادیر prop می‌توانند شامل state expressions باشند:
 *   - $key.path     → resolve از state (با unwrap signals).
 *   - "literal"     → string.
 *   - true/false    → boolean.
 *   - 123 / 1.5     → number.
 *   - {...} / [...] → JSON.parse.
 *
 * @param attrs  رشته‌ی attributeها (مثلاً ' name="x" prop:foo="bar"').
 * @param state  آبجکت state برای resolve کردن $ expressions (اختیاری).
 */
export function parseServerComponentAttrs(
  attrs: string,
  state: Record<string, unknown> = {},
): { name: string; props: Record<string, unknown> } {
  const props: Record<string, unknown> = {};
  let name = '';

  // Attribute regex:
  //   name="value"     → group 1=name, group 2=value
  //   name='value'     → group 1=name, group 3=value
  //   name=value        → group 1=name, group 4=value (تا اولین whitespace)
  //   name (boolean)   → group 5=name
  const ATTR_REGEX = /(\S+?)=(?:"([^"]*)"|'([^']*)'|(\S+))|(\S+)/g;
  let am: RegExpExecArray | null;
  ATTR_REGEX.lastIndex = 0;
  while ((am = ATTR_REGEX.exec(attrs)) !== null) {
    const attrName: string = am[1] || am[5] || '';
    const attrValue: string = am[2] ?? am[3] ?? am[4] ?? '';
    if (!attrName) continue;

    if (attrName === 'name') {
      name = attrValue;
    } else if (attrName.startsWith('prop:')) {
      const propName = attrName.slice('prop:'.length);
      if (propName) {
        props[propName] = resolvePropValue(attrValue, state);
      }
    }
    // attributeهای دیگر (مثل class, id) نادیده گرفته می‌شوند.
  }

  return { name, props };
}

/**
 * تبدیل مقدار prop به نوع مناسب.
 *
 * - اگر با $ شروع شود → expression به state (مثل $post.body).
 * - اگر "true"/"false" → boolean.
 * - اگر "null"/"undefined" → null/undefined.
 * - اگر عدد باشد → number.
 * - اگر با { یا [ شروع شود → JSON.parse.
 * - در غیر این صورت → string.
 */
function resolvePropValue(raw: string, state: Record<string, unknown>): unknown {
  const trimmed = raw.trim();
  if (trimmed === '') return '';

  // State expression: $key.path.to.value
  if (trimmed.startsWith('$')) {
    return resolveStateExpression(trimmed, state);
  }

  // #120: literal/JSON با helper مشترک `@zenith/schema` تبدیل می‌شود
  // (boolean/number/JSON یک‌جا؛ JSON خراب ⇒ رشتهٔ اصلی با کد ZEN-1003).
  return parseJsonValue(raw, {
    onError: (err) => logger.warn(`[zenith:ssr] ${err.message}`),
  });
}

/**
 * Resolve کردن یک state expression به‌صورت $key.path.to.value.
 *
 * - key ابتدا در state lookup می‌شود.
 * - اگر مقدار یک signal باشد (تابع get دارد)، unwrap می‌شود.
 * - سپس path به‌صورت dotted پیمایش می‌شود.
 *
 * مثال: state = { post: signal({ body: 'hello' }) }
 *        '$post.body' → 'hello'
 *
 * اگر path نامعتبر باشد یا مقدار undefined باشد، undefined برمی‌گرداند.
 */
function resolveStateExpression(expr: string, state: Record<string, unknown>): unknown {
  // حذف $ از ابتدا.
  const pathStr = expr.slice(1);
  if (!pathStr) return undefined;

  const segments = pathStr.split('.');
  let current: unknown = state;

  // اولین segment: lookup در state.
  const firstKey = segments[0];
  if (firstKey == null || !(firstKey in state)) return undefined;
  current = state[firstKey];

  // unwrap signal برای root.
  if (current != null && (typeof current === 'object' || typeof current === 'function') && 'get' in current && typeof current.get === 'function') {
    current = current.get();
  }

  // بقیه‌ی segmentها: پیمایش path.
  for (let i = 1; i < segments.length; i++) {
    if (current == null) return undefined;
    current = Reflect.get(Object(current), segments[i]!);
    // Reflect is a host boundary; the traversal value remains unknown.
    // unwrap signal در هر سطح.
    if (current != null && (typeof current === 'object' || typeof current === 'function') && 'get' in current && typeof current.get === 'function') {
      current = current.get();
    }
  }

  return current;
}
