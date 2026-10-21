// packages/storage/src/types.ts
//
// #145 — انواع @zenith/storage (SPEC §۲.۵). صفر runtime.
//
// قوانین لایه (گیت test/layering.test.ts):
//   • وابستگی فقط errors + shared + logger (L0 → L0/L0). هیچ import از
//     state/scheduler (L1): سیگنال ذخیره با reactive ساختاری خودکفا ساخته
//     می‌شود و `Readable<T>` ساختاری (DEC-021) را برآورده می‌کند.
//   • هیچ دسترسی به window/document در import-time (گیت env-import).
import type { Cleanup, Disposable, Readable } from '@zenith/shared';

/** نام درایورهای内置 (SPEC §۲.۵). */
export type DriverName = 'local' | 'session' | 'memory' | 'indexeddb' | 'cookie';

/** اینترفیس سطح پایین یک درایور (کی‌بنووردی رشته‌ای، هم‌شکل WebStorage). */
export interface StorageDriver {
  /** نام برای پیام‌ها/عیبیابی. */
  readonly name: DriverName | string;
  /** آیا این درایور در محیط فعلی قابل‌استفاده است؟ (بدون throw). */
  available(): boolean;
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** کلیدهای ذخیره‌شده (با namespace؛ فیلتر در لایهٔ createStorage). */
  keys(): string[];
  clear(): void;
  /** آماده‌سازی async (فقط indexeddb). */
  ready?(): Promise<void>;
}

/** گزینه‌های کوکی (SPEC §۲.۵). HttpOnly از کلاینت ممکن نیست — docs/security هشدار می‌دهد. */
export interface CookieOptions {
  path?: string;
  domain?: string;
  sameSite?: 'Strict' | 'Lax' | 'None';
  secure?: boolean;
  /** عمر به ثانیه؛ نبودش یعنی کوکی جلسه‌ای. */
  maxAge?: number;
}

/** گزینه‌های درایور IndexedDB. */
export interface IDBOptions {
  /** نام دیتابیس. @default 'zenith-storage' */
  db?: string;
  /** نام object store. @default 'kv' */
  store?: string;
}

/** سریال‌ساز قابل‌تزریق. @default JSON */
export interface Serializer {
  stringify(value: unknown): string;
  parse(text: string): unknown;
}

/** سیاست مدیریت quota (SPEC §۲.۵). @default 'evict-oldest' */
export type QuotaPolicy = 'throw' | 'evict-oldest' | 'ignore';

/** اعتبارسنج دادهٔ decoded (SPEC §۲.۵ امنیت: داده دست‌کاری‌شده پذیرفته نشود). */
export type DataValidator = ((value: unknown) => unknown) | { validate(value: unknown): unknown };

/** گزینه‌های `set` per-key. */
export interface SetOptions {
  /** ttl بر حسب ms؛ 0 یا `'never'` ⇒ بدون انقضا. */
  ttl?: number | 'never';
}

/** رویداد subscribe. */
export interface StorageEventPayload<T = unknown> {
  key: string;
  value: T | undefined;
  /** منشأ تغییر: local (همین instance)، tab (تب دیگر)، remove (حذف). */
  origin: 'local' | 'tab' | 'remove';
}

/** باس تزریق‌پذیر همگام‌سازی بین‌تب (پیش‌فرض: رویداد storage مرورگر؛ fake در تست). */
export interface SyncBus {
  subscribe(onMessage: (key: string, removed: boolean, localWrite: boolean) => void): Cleanup;
  publish(key: string, removed: boolean): void;
  close(): void;
}

/** گزینه‌های `createStorage` (SPEC §۲.۵). */
export interface StorageOptions {
  /** @default 'local' در مرورگر، 'memory' در سرور */
  driver?: DriverName | StorageDriver;
  /** پیشوند کلیدها (`ns:key`). @default 'zen' */
  namespace?: string;
  /** نسخهٔ اسکیما. @default 1 */
  version?: number;
  /** تبدیل دادهٔ نسخهٔ قدیمی؛ بدون آن ⇒ دادهٔ کهنه دور ریخته می‌شود. */
  migrate?: (old: unknown, fromVersion: number) => unknown;
  serializer?: Serializer;
  /** ttl پیش‌فرض (ms) یا `'never'`. @default 'never' */
  ttl?: number | 'never';
  /** همگام‌سازی بین تب‌ها. @default true */
  sync?: boolean;
  /** حساس ⇒ نوشتن در local/session/indexeddb ممنوع (fallback به memory). @default false */
  sensitive?: boolean;
  /** @default 'evict-oldest' */
  onQuotaExceeded?: QuotaPolicy;
  /** گزینه‌های کوکی (driver=cookie). */
  cookie?: CookieOptions;
  /** گزینه‌های IndexedDB (driver=indexeddb). */
  indexedDB?: IDBOptions;
  /** ساعت تزریقی (ttl قطعی/تست). @default Date.now */
  clock?: () => number;
  /** مقادیر اولیه (SSR: تزریق از کوکی درخواست). */
  seed?: Record<string, unknown>;
  /** اعتبارسنجی اختیاری داده هنگام خواندن. */
  validate?: DataValidator;
  /** کارخانهٔ باس همگام‌سازی (تزریق fake در تست). */
  syncBus?: () => SyncBus;
}

/**
 * هویت هر record درون درایور رشته‌ای:
 * `v` نسخه، `t` زمان نوشتن (ms؛ مبنای evict-oldest)، `e` زمان انقضا (null ⇒ never)، `d` داده.
 */
export interface StorageRecord {
  v: number;
  t: number;
  e: number | null;
  d: unknown;
}

/** سیگنال ذخیره‌سازی (زیرمسیر /signal و متد `storage.signal`) — ساختاری Readable. */
export interface StorageSignal<T = unknown> extends Readable<T>, Disposable {
  set(value: T): void;
  subscribe(cb: (value: T) => void): Cleanup;
}

/** قرارداد SPEC §۲.۵ — `ZenithStorage` یک `Disposable` است. */
export interface ZenithStorage extends Disposable {
  get<T = unknown>(key: string, def?: T): T | undefined;
  set<T = unknown>(key: string, value: T, opts?: SetOptions): void;
  remove(key: string): boolean;
  has(key: string): boolean;
  keys(): string[];
  clear(): void;
  subscribe<T = unknown>(key: string, cb: (payload: StorageEventPayload<T>) => void): Cleanup;
  /** سیگنال همگام با ذخیره و تب‌های دیگر (SPEC: `storage.signal(key, initial)`). */
  signal<T = unknown>(key: string, initial: T): StorageSignal<T>;
  /** آماده‌سازی async برای indexeddb؛ در سایر درایورها resolve فوری. */
  ready: Promise<void>;
  /** نام درایور مؤثر (پس از fallback). */
  readonly driverName: string;
}

/** شکل خروجی `parsePersistAttr` (attribute zen-persist، گرامر §۰.۳). */
export interface PersistConfig {
  key: string;
  driver?: DriverName;
  ttl?: number | 'never';
  version?: number;
  debounce?: number;
  /** ورودی نامعتبر ⇒ `invalid: true` (directive مسئول گزارش UI است، نه throw). */
  invalid?: boolean;
}

/** حداقل شکل ساختاری یک store برای `persistStore` (بدون یال به L1). */
export interface PersistTarget<S = unknown> {
  readonly state: S;
  /** اشتراک تغییرات state (در @zenith/store: `store.$subscribe`). */
  $subscribe(cb: (state: S) => void): Cleanup;
  /** اعمال مقدار ذخیره‌شده هنگام hydrate (در @zenith/store: `$patch`). */
  $patch(partial: Partial<S>): void;
}

/** گزینه‌های `persistStore`. */
export interface PersistOptions<S = unknown> {
  /** instance هدف (پیش‌فرض: singleton `getDefaultStorage()`). */
  storage?: ZenithStorage;
  /** کلید ذخیره (required). */
  key: string;
  /** زیرمجموعهٔ state برای ذخیره. @default تمام state */
  selector?: (state: S) => unknown;
  /** تأخیر نوشتن (ms). @default 300 @unit ms */
  debounce?: number;
}
