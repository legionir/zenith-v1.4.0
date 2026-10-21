// packages/ssr/src/server-component-render.ts
//
// رندر ServerComponent با markerها — استخراج مکانیکی از server-component.ts،
// بدون تغییر رفتار (#40).

import { getServerComponent } from './server-component-registry';


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
  props: Record<string, unknown> = {},
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
    try {
      html = String(html);
    } catch {
      html = '';
    }
  }

  return `${open}${html}${close}`;
}
