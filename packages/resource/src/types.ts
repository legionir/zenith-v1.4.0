/**
 * وضعیت یک Resource.
 * @public
 */
export interface ResourceState<T = unknown> {
  /** داده‌های فعلی (لیست یا تک آیتم). */
  data: T | null;
  /** آیا در حال loading است؟ */
  loading: boolean;
  /** پیام خطا (اگر وجود دارد). */
  error: string | null;
  /** زمان آخرین به‌روزرسانی موفق (timestamp). */
  lastUpdated: number | null;
  /** آیا داده‌های stale است؟ (باید refresh شود) */
  isStale: boolean;
}

/**
 * پیکربندی یک Resource.
 * @public
 */
export interface ResourceConfig {
  /** URL پایه (مثل '/api/users'). */
  url: string;
  /** مدت زمان stale شدن (میلی‌ثانیه). پیش‌فرض: 60000 (۱ دقیقه). */
  staleTime?: number;
  /** تعداد تلاش مجدد در صورت خطا. پیش‌فرض: 3. */
  retryCount?: number;
  /** فاصله‌ی بین تلاش‌های مجدد (میلی‌ثانیه). پیش‌فرض: 1000. */
  retryDelay?: number;
  /** آیا optimistic update فعال باشد؟ پیش‌فرض: true. */
  optimistic?: boolean;
  /** هدرهای اضافی. */
  headers?: Record<string, string>;
  /** آیا credentials ارسال شود؟ پیش‌فرض: 'same-origin'. */
  credentials?: RequestCredentials;
  // FEATURE (v0.4.0): ادغام با Service Worker (@zenith/service-worker).
  //
  // اگر این فیلد ست شود، نشان‌دهنده‌ی این است که درخواست‌های شبکه‌ی این Resource
  // توسط یک Service Worker با استراتژی کش مشخص‌شده拦截 (intercept) می‌شوند. این
  // فیلد به‌صورت documentation-level است — خود Resource اینجا چیزی را تغییر نمی‌دهد،
  // بلکه SW فایل (`@zenith/service-worker/sw`) باید با یک Route مطابق `config.url`
  // و `cacheName` مساوی این مقدار پیکربندی شود تا واقعاً caching صورت گیرد.
  //
  // مثال:
  //   const users = createResource('users', {
  //     url: '/api/users',
  //     swCacheName: 'users-cache',  // ← SW باید این cacheName را بداند
  //   });
  //
  // و در فایل sw.js:
  //   setupSW({
  //     routes: [
  //       { urlPattern: '/api/users', strategy: 'networkFirst', cacheName: 'users-cache' },
  //     ],
  //   });
  /** نام cache در Service Worker برای این Resource (اختیاری، v0.4.0). */
  swCacheName?: string;
}

/**
 * نوع عملیات CRUD.
 * @public
 */
export type CrudOperation = 'list' | 'create' | 'read' | 'update' | 'delete';

/**
 * نتیجه‌ی یک عملیات.
 * @public
 */
export interface CrudResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

