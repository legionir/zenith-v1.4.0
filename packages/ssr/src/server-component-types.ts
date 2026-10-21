// packages/ssr/src/server-component-types.ts
//
// تایپ ServerComponent — استخراج مکانیکی از server-component.ts،
// بدون تغییر رفتار (#40).


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
  render: (props: Record<string, unknown>) => Promise<string> | string;
}
