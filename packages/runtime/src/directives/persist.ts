// packages/runtime/src/directives/persist.ts
//
// #145 — دایرکتیو zen-persist (SPEC §۲.۵ «attributeها»):
//   <input zen-model="$path" zen-persist="key"
//          zen-persist-driver="local" zen-persist-ttl="never"
//          zen-persist-version="1" zen-persist-debounce="300ms">
//
// رفتار:
//   • فقط روی المان دارای zen-model معنا دارد (SPEC); بدون آن ⇒ هشدار no-op.
//   • hydrate: اگر کلید در storage هست، مقدار با setSignalFromPath روی مسیر
//     zen-model اعمال می‌شود (همان مسیری که تایپ کاربر می‌نویسد).
//   • ذخیره: رویداد input/change (همان تشخیص نوع model.ts) ⇒ نوشتن debounce‌شده.
//   • همگام‌سازی بین‌تب: storage.subscribe روی کلید ⇒ منعکس شدن نوشتۀ تب دیگر.
//   • attribute نامعتبر (parsePersistAttr.invalid) ⇒ logger.warn و بی‌عمل —
//     throw نمی‌کنیم (قرارداد directive/UI، همان parseCacheAttr #144).
//
// چرا logger و نه console: no-console:true برای src جدید (گیت ratchet #143
// فقط کوتاه می‌شود)؛ الگوی خودِ @zenith/storage (DEC-030).
import { logger } from '@zenith/logger';
import {
  createStorage,
  driverByName,
  parsePersistAttr,
  type DriverName,
  type PersistConfig,
  type ZenithStorage,
} from '@zenith/storage';
import { isSignal } from '../context';
import { clonePathContainer } from './path-container';

// نمونهٔ storage به‌ازای هر (driver, version) — SPEC §۲.۵: namespace پیش‌فرض
// 'zen'، sync:true. ماژول‌سطح است تا چند المان با یک درایور یک subscription
// مرورگری داشته باشند؛ ساخت با اولین فراخوانی (هیچ دسترسی env در import-time).
const storageByKey = new Map<string, ZenithStorage>();
function storageFor(driver: DriverName, version: number | undefined): ZenithStorage {
  const cacheKey = `${driver}|v${version ?? 1}`;
  let s = storageByKey.get(cacheKey);
  if (!s) {
    s = createStorage({ driver: driverByName(driver), version });
    storageByKey.set(cacheKey, s);
  }
  return s;
}

/** تشخیص رویداد/مقدار ورودی — همان قرارداد model.ts (checkbox/select/number/text). */
function getInputConfig(el: HTMLElement): { eventName: string; readValue: () => unknown } {
  const type = (el as HTMLInputElement).type;
  if (type === 'checkbox') {
    return { eventName: 'change', readValue: () => (el as HTMLInputElement).checked };
  }
  if (el.tagName === 'SELECT') {
    return { eventName: 'change', readValue: () => (el as HTMLSelectElement).value };
  }
  if (type === 'number' || type === 'range') {
    return {
      eventName: 'input',
      readValue: () => {
        const raw = (el as HTMLInputElement).value;
        return raw === '' ? null : Number(raw);
      },
    };
  }
  return { eventName: 'input', readValue: () => (el as HTMLInputElement).value };
}

function attrsOf(el: HTMLElement): Parameters<typeof parsePersistAttr>[1] {
  return {
    driver: el.getAttribute('zen-persist-driver'),
    ttl: el.getAttribute('zen-persist-ttl'),
    version: el.getAttribute('zen-persist-version'),
    debounce: el.getAttribute('zen-persist-debounce'),
  };
}

export function processPersist(
  el: HTMLElement,
  keyExpr: string,
  context: Record<string, unknown>,
  state: Record<string, unknown>,
): () => void {
  const modelExpr = el.getAttribute('zen-model');
  if (!modelExpr) {
    logger.warn('zen-persist: requires zen-model on the same element', { key: keyExpr });
    return () => {};
  }
  // مسیر zen-model پس از نگهبان بالا غیرnull است؛ نام مستقل برای closure پایین.
  const modelPath: string = modelExpr;

  const config: PersistConfig = parsePersistAttr(keyExpr, attrsOf(el));
  if (config.invalid || !config.key) {
    logger.warn('zen-persist: invalid attribute value (no-op)', {
      key: keyExpr,
      driver: config.driver,
      ttl: config.ttl,
    });
    return () => {};
  }

  const storage = storageFor(config.driver ?? 'local', config.version);
  const key = config.key;
  const debounceMs = config.debounce ?? 300;

  // ── hydrate: مقدار ذخیره‌شده (اگر هست) روی مسیر zen-model اعمال می‌شود ──
  const stored = storage.get<unknown>(key);
  if (stored !== undefined) writeState(stored);

  // ── ذخیره با debounce (timer واحد) ──
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: unknown;
  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    storage.set(key, pending, config.ttl === undefined ? undefined : { ttl: config.ttl });
  };

  const configInput = getInputConfig(el);
  const onEvent = () => {
    // همان مقداری که zen-model به signal می‌دهد: model زودتر روی همین رویداد
    // ثبت شده و signal را آپدیت می‌کند؛ منبع ما el است تا به ترتیب
    // listenerها وابسته نباشیم.
    pending = configInput.readValue();
    if (debounceMs <= 0) flush();
    else if (timer === null) timer = setTimeout(flush, debounceMs);
  };
  el.addEventListener(configInput.eventName, onEvent);

  // ── تب دیگر نوشت ⇒ همین‌جا هم reflect شود ──
  const offTab = storage.subscribe<unknown>(key, (payload) => {
    if (payload.origin !== 'tab') return;
    writeState(payload.value);
  });

  function writeState(value: unknown): void {
    // setSignalFromPath در model.ts private است؛ همان قرارداد اینجا با
    // مسیرهای dot/bracket ساده (SPEC attribute surface کوچک است).
    if (!applyPath(state, context, modelPath, value)) {
      logger.warn('zen-persist: signal path not found for zen-model', { path: modelPath });
    }
  }

  return () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    el.removeEventListener(configInput.eventName, onEvent);
    offTab();
  };
}

// ── مسیرنگاری: $obj.a.b / $arr[0].name روی Signalها (الگوی model.ts) ──
function parsePath(path: string): string[] {
  return path
    .replace(/^\$/, '')
    .split(/[.[\]]/)
    .map((p) => p.replace(/^['"]|['"]$/g, ''))
    .filter((p) => p !== '');
}

function applyPath(
  state: Record<string, unknown>,
  context: Record<string, unknown>,
  expr: string,
  value: unknown,
): boolean {
  const parts = parsePath(expr);
  if (parts.length === 0) return false;
  const root = state[parts[0]!] ?? context[parts[0]!];
  if (!isSignal(root)) return false;
  if (parts.length === 1) {
    Reflect.apply(root.set, root, [value]);
    return true;
  }
  const current = root.get();
  const copy = clonePathContainer(current);
  let target = copy;
  for (let i = 1; i < parts.length - 1; i++) {
    target[parts[i]!] = clonePathContainer(target[parts[i]!]);
    target = target[parts[i]!] as Record<string, unknown>;
  }
  target[parts[parts.length - 1]!] = value;
  Reflect.apply(root.set, root, [copy]);
  return true;
}
