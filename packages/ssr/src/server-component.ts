// packages/ssr/src/server-component.ts
//
// FEATURE (v0.4.0): Server Components — کامپوننت‌هایی که کاملاً در سرور
// رندر می‌شوند و در کلاینت hydrate نمی‌شوند. این مزیت بزرگ Zenith نسبت
// به React است: HTML-First بودن به‌طور ذاتی از Server Components پشتیبانی
// می‌کند بدون نیاز به JSX یا Virtual DOM.
//
// ── نحوه کار ──
//
//   1. کاربر یک ServerComponent تعریف می‌کند (تابع async که HTML برمی‌گرداند).
//   2. در قالب HTML: <zen-server-component name="x" prop:foo="bar" />
//      یا       <zen-server-component name="x" prop:foo="bar">slot content</zen-server-component>
//   3. در renderToString: pre-pass تمام این تگ‌ها را پیدا می‌کند،
//      comp.render(props) را فراخوانی می‌کند و HTML را جایگزین می‌کند.
//   4. خروجی با marker comments احاطه می‌شود:
//        <!--zenith-server-component:x-->...HTML...<!--/zenith-server-component:x-->
//      این markerها به hydrate می‌گویند که آن زیردرخت را رد کند (static).
//   5. در hydrate: walker وارد این مناطق نمی‌شود چون تمام attributeهای
//      zen-* از عناصر داخل آن پاک شده‌اند.
//
// ─ـ Server-Only ──
//
// این ماژول فقط در سرور استفاده می‌شود. هیچ ارجاعی به `window` یا
// `document` در آن وجود ندارد چون کد render فقط روی سرور اجرا می‌شود.
// در کلاینت، فقط marker comments دیده می‌شوند که توسط hydrate پردازش
// می‌شوند (نه این ماژول).
//
// ── محدودیت‌ها (v0.4.0) ──
//
//   - Nested <zen-server-component> پشتیبانی نمی‌شود. برای nesting،
//     یک کامپوننت باید خودش تگ <zen-server-component> در خروجی render
//     خودش تولید کند و بعد یک inline pass دیگر روی خروجی اعمال شود.
//   - Expressionهای پیچیده در propها (مثل ${a + b}) پشتیبانی نمی‌شود.
//     فقط $key.path برای ارجاع به state پشتیبانی می‌شود.

// ── TYPES ──

/**
 * یک Server Component.
 *
 * @property name   نام یکتای کامپوننت (در registry).
 * @property render تابعی که props می‌گیرد و HTML برمی‌گرداند.
 *                  می‌تواند async باشد (مثلاً برای fetch داده از DB).
 */
export interface ServerComponent {
  readonly name: string;
  render: (props: Record<string, any>) => Promise<string> | string;
}

// ── REGISTRY ──

/**
 * Registry سراسری از نام → ServerComponent.
 *
 * این registry فقط در سرور استفاده می‌شود (در کلاینت قابل import نیست
 * چون کد render فقط روی سرور اجرا می‌شود). در SSR concurrent، registry
 * بین درخواست‌ها به‌صورت read-only مشترک است — کامپوننت‌ها باید
 * stateless باشند یا state خود را از props بگیرند.
 */
const serverComponentRegistry = new Map<string, ServerComponent>();

/**
 * ثبت یک Server Component در registry.
 * اگر قبلاً با همین نام ثبت شده، overwrite می‌شود (برای HMR مفید است).
 *
 * @throws اگر comp نامعتبر باشد (بدون name یا render).
 */
export function registerServerComponent(comp: ServerComponent): void {
  if (!comp || typeof comp.name !== 'string' || comp.name.length === 0) {
    throw new Error('[Zenith SSR] Invalid ServerComponent: name is required.');
  }
  if (typeof comp.render !== 'function') {
    throw new Error(`[Zenith SSR] Invalid ServerComponent "${comp.name}": render() must be a function.`);
  }
  // BUG-SSR-03 FIX (v1.3.0): اگر کامپوننتی با همین نام از قبل ثبت شده باشد،
  // در حالت توسعه یک هشدار چاپ کن. این برای HMR مفید است اما overwrite
  // تصادفی (مثلاً import دوتایی از یک فایل) را هم هشدار می‌دهد.
  if (serverComponentRegistry.has(comp.name)) {
    console.warn(
      `[Zenith SSR] ServerComponent "${comp.name}" is being overwritten. ` +
      `This is expected during HMR, but if it happens at startup, ` +
      `check for duplicate registrations or conflicting component names.`
    );
  }
  serverComponentRegistry.set(comp.name, comp);
}

/**
 * گرفتن یک Server Component از registry.
 * اگر وجود نداشت، undefined برمی‌گرداند.
 */
export function getServerComponent(name: string): ServerComponent | undefined {
  return serverComponentRegistry.get(name);
}

/**
 * حذف یک Server Component از registry.
 * برای تست‌ها و HMR.
 *
 * @returns true اگر حذف شد، false اگر وجود نداشت.
 */
export function unregisterServerComponent(name: string): boolean {
  return serverComponentRegistry.delete(name);
}

/**
 * پاکسازی کل registry.
 * عمدتاً برای تست‌ها.
 */
export function clearServerComponents(): void {
  serverComponentRegistry.clear();
}

// ── RENDER ──

/**
 * نام markerهای اطراف HTML رندرشده‌ی یک Server Component.
 *
 *   OPEN:  <!--zenith-server-component:NAME-->
 *   CLOSE: <!--/zenith-server-component:NAME-->
 *
 * این فرمت برای hydrate قابل parse است و نام کامپوننت را هم ذخیره
 * می‌کند (برای debug و DevTools).
 */
export const SERVER_COMPONENT_OPEN_PREFIX = 'zenith-server-component:';
export const SERVER_COMPONENT_CLOSE_PREFIX = '/zenith-server-component:';

/**
 * ساخت marker comment بازشونده.
 */
export function makeOpenMarker(name: string): string {
  return `<!--${SERVER_COMPONENT_OPEN_PREFIX}${name}-->`;
}

/**
 * ساخت marker comment بست‌شونده.
 */
export function makeCloseMarker(name: string): string {
  return `<!--${SERVER_COMPONENT_CLOSE_PREFIX}${name}-->`;
}

/**
 * رندر یک Server Component با نام و props داده‌شده.
 *
 * HTML خروجی با marker comments احاطه می‌شود تا hydrate بداند آن را رد کند.
 *
 * اگر کامپوننت ثبت نشده باشد، یک کامنت خطا رندر می‌شود (تا صفحه خراب
 * نشود و در DevTools مشخص باشد چه چیزی اشتباه است).
 *
 * اگر render خطا دهد، یک کامنت خطا رندر می‌شود.
 *
 * @param name   نام کامپوننت در registry.
 * @param props  Props پاس‌داده‌شده به render().
 * @returns HTML شامل marker comments.
 */
export async function renderServerComponent(
  name: string,
  props: Record<string, any> = {},
): Promise<string> {
  const open = makeOpenMarker(name);
  const close = makeCloseMarker(name);

  const comp = getServerComponent(name);
  if (!comp) {
    return `${open}<!-- ERROR: server component "${name}" not registered -->${close}`;
  }

  let html: string;
  try {
    html = await comp.render(props);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // escape موقت برای جلوگیری از injection در HTML (simplified).
    const safeMsg = msg.replace(/-->/g, '--&gt;').replace(/</g, '&lt;');
    return `${open}<!-- server-component-error: ${safeMsg} -->${close}`;
  }

  // اگر render خالی برگرداند یا non-string، آن را به string تبدیل کن.
  if (html == null) html = '';
  if (typeof html !== 'string') {
    try { html = String(html); } catch { html = ''; }
  }

  return `${open}${html}${close}`;
}

// ── FACTORY ──

/**
 * Factory helper برای تعریف یک Server Component با type safety.
 *
 * استفاده:
 *   const Markdown = defineServerComponent('markdown', async (props) => {
 *     return `<div class="markdown">${props.content}</div>`;
 *   });
 *   registerServerComponent(Markdown);
 *
 * یا به‌صورت inline:
 *   registerServerComponent(defineServerComponent('header', (p) => `<h1>${p.title}</h1>`));
 *
 * @param name   نام کامپوننت.
 * @param render تابع رندر.
 */
export function defineServerComponent(
  name: string,
  render: (props: Record<string, any>) => Promise<string> | string,
): ServerComponent {
  return { name, render };
}

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

interface FoundTag {
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
function findServerComponentTags(html: string): FoundTag[] {
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
function parseServerComponentAttrs(
  attrs: string,
  state: Record<string, any> = {},
): { name: string; props: Record<string, any> } {
  const props: Record<string, any> = {};
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
function resolvePropValue(raw: string, state: Record<string, any>): any {
  const trimmed = raw.trim();
  if (trimmed === '') return '';

  // State expression: $key.path.to.value
  if (trimmed.startsWith('$')) {
    return resolveStateExpression(trimmed, state);
  }

  // Literals
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (trimmed === 'undefined') return undefined;

  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isNaN(num)) return num;
  }

  // JSON (object یا array)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // اگر parse نشد، string اصلی را برگردان.
      return raw;
    }
  }

  return raw;
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
function resolveStateExpression(expr: string, state: Record<string, any>): any {
  // حذف $ از ابتدا.
  const pathStr = expr.slice(1);
  if (!pathStr) return undefined;

  const segments = pathStr.split('.');
  let current: any = state;

  // اولین segment: lookup در state.
  const firstKey = segments[0];
  if (firstKey == null || !(firstKey in state)) return undefined;
  current = state[firstKey];

  // unwrap signal برای root.
  if (current != null && typeof current.get === 'function') {
    current = current.get();
  }

  // بقیه‌ی segmentها: پیمایش path.
  for (let i = 1; i < segments.length; i++) {
    if (current == null) return undefined;
    current = current[segments[i]];
    // unwrap signal در هر سطح.
    if (current != null && typeof current.get === 'function') {
      current = current.get();
    }
  }

  return current;
}

// ── INLINE PASS ──

/**
 * یک pass تکی روی HTML: پیدا کردن تمام تگ‌های <zen-server-component> در
 * HTML فعلی و جایگزینی آن‌ها با HTML رندرشده‌ی کامپوننت.
 *
 * این تابع async است چون render ممکن است async باشد. تمام کامپوننت‌ها
 * به‌صورت موازی (Promise.all) رندر می‌شوند تا latency کاهش یابد.
 *
 * @param html   HTML ورودی این pass.
 * @param tags   تگ‌های پیدا شده (با findServerComponentTags).
 * @param state  آبجکت state برای resolve کردن $ expressions در props.
 * @returns HTML با تگ‌های این pass جایگزین‌شده.
 */
async function singlePass(
  html: string,
  tags: FoundTag[],
  state: Record<string, any>,
): Promise<string> {
  // رندر موازی همه‌ی کامپوننت‌ها.
  const rendered = await Promise.all(
    tags.map(async (tag) => {
      const { name, props } = parseServerComponentAttrs(tag.attrs, state);
      // اگر تگ non-self-closing باشد، inner content به‌عنوان prop `children`
      // پاس داده می‌شود (مثل React).
      if (tag.inner !== undefined) {
        props.children = tag.inner;
      }
      return renderServerComponent(name, props);
    }),
  );

  // ساخت HTML نهایی: از انتها به ابتدا جایگزین کن تا اندیسها ثابت بمانند.
  // tags به ترتیب document مرتب هستند (از کم به زیاد).
  let result = html;
  for (let i = tags.length - 1; i >= 0; i--) {
    const tag = tags[i];
    const replacement = rendered[i];
    if (typeof replacement !== 'string') continue;
    result =
      result.slice(0, tag.start) + replacement + result.slice(tag.end);
  }

  return result;
}

/**
 * پیدا کردن تمام تگ‌های <zen-server-component> در HTML و جایگزینی
 * آن‌ها با HTML رندرشده‌ی کامپوننت.
 *
 * FEATURE (v0.5.0): Nested Server Components — اگر خروجی render یک
 * کامپوننت خودش شامل تگ‌های <zen-server-component> باشد، آن‌ها به‌صورت
 * بازگشتی رندر می‌شوند. این کار با یک حلقه انجام می‌شود که در هر pass
 * یک سطح از nesting را حل می‌کند. MAX_PASSES=10 برای جلوگیری از loop
 * بی‌نهایت (مثلاً اگر کامپوننتی خودش را فراخوانی کند).
 *
 * @param html   HTML ورودی.
 * @param state  آبجکت state برای resolve کردن $ expressions در props.
 * @returns HTML با تمام تگ‌های (شامل nested) جایگزین‌شده. اگر تگی پیدا
 *          نشود، html اصلی بدون تغییر برگردانده می‌شود.
 */
export async function inlineServerComponents(
  html: string,
  state: Record<string, any> = {},
): Promise<string> {
  let result = html;
  let MAX_PASSES = 10;
  while (MAX_PASSES-- > 0) {
    const tags = findServerComponentTags(result);
    if (tags.length === 0) break;
    result = await singlePass(result, tags, state);
  }
  return result;
}
