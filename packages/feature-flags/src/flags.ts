// packages/feature-flags/src/flags.ts
//
// @zenith/feature-flags (#168) — پرچم‌های ویژگی واکنشی L2:
//   flag(name, def) → ReadonlySignal<boolean>
//   variant(name) → ReadonlySignal<string|null>
//   rollout پایدار hash(userId)，バaootstrap برای SSR بدون فلیکر.

import { signal, computed, type Signal, type ReadonlySignal } from '@zenith/state';
import { createStorage, type ZenithStorage } from '@zenith/storage';
import { createReservedError } from '@zenith/errors';
import type { Disposable, Cleanup } from '@zenith/shared';

export type FlagValue = boolean | { enabled: boolean; rollout?: number; variant?: string };
export type FlagSource =
  | Record<string, FlagValue>
  | ((context: FlagContext) => Promise<Record<string, FlagValue>>);

export interface FlagContext {
  userId?: string;
  roles?: string[];
  [key: string]: unknown;
}

export interface FlagsOptions {
  source: FlagSource;
  context?: FlagContext;
  rollout?: 'hash' | 'random';
  persist?: boolean;
  storageKey?: string;
  refreshInterval?: number;
  /** SSR: دیتای اولیه برای جلوگیری از flicker */
  bootstrap?: Record<string, FlagValue>;
  storage?: ZenithStorage;
}

export interface Flags extends Disposable {
  flag(name: string, def?: boolean): ReadonlySignal<boolean>;
  variant(name: string): ReadonlySignal<string | null>;
  setContext(next: FlagContext): void;
  override(name: string, value: FlagValue): Cleanup;
  refresh(): Promise<void>;
  dispose(): void;
}

/**
 * #53 / #168: پیش‌فرض‌های منجمد feature-flags.
 * @default { rollout: 'hash', persist: false, storageKey: 'zen.flags', refreshInterval: 0 }
 * @since 1.4.0
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  rollout: 'hash' as const,
  persist: false,
  storageKey: 'zen.flags',
  refreshInterval: 0,
});

/**
 * #168: rollout پایدار — hash یکسان برای یک userId+flag همیشه نتیجهٔ یکسان.
 * FNV-1a ساده و قطعی (بدون crypto چون hot path است).
 */
export function stableHashRollout(name: string, userId: string): number {
  const key = `${name}:${userId}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    // Math.imul 32-bit FNV prime multiply.
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
}

function normalize(value: FlagValue | undefined, def: boolean): { enabled: boolean; variant: string | null } {
  if (value === undefined) return { enabled: def, variant: null };
  if (typeof value === 'boolean') return { enabled: value, variant: null };
  return { enabled: Boolean(value.enabled), variant: value.variant ?? null };
}

export function createFlags(options: FlagsOptions): Flags {
  const opts = { ...DEFAULTS, ...options };
  let data: Record<string, FlagValue> = {};
  const overrides: Signal<Record<string, FlagValue>> = signal({});
  const contextSig: Signal<FlagContext> = signal(opts.context ?? {});
  const tick: Signal<number> = signal(0); // برای ایجاد واکنش به refreshAsync

  if (typeof opts.source !== 'function') {
    data = { ...opts.source };
  }
  if (opts.bootstrap) {
    data = { ...data, ...opts.bootstrap };
  }

  let storage: ZenithStorage | null = null;
  if (opts.persist) {
    try {
      storage = opts.storage ?? createStorage({ namespace: '' });
      const cached = storage.get(opts.storageKey) as Record<string, FlagValue> | null;
      if (cached) data = { ...cached, ...data };
    } catch (cause) {
      throw createReservedError('ZEN-2202', { cause });
    }
  }

  const computeEnabled = (name: string, def: boolean): boolean => {
    const all = overrides.get();
    const raw: FlagValue | undefined = name in all ? all[name] : data[name];
    const { enabled, variant } = normalize(raw, def);
    if (!enabled) return false;
    if (typeof raw === 'object' && raw !== null && typeof raw.rollout === 'number') {
      const pct = Math.max(0, Math.min(100, raw.rollout));
      if (pct >= 100) return true;
      if (pct <= 0) return false;
      const ctx = contextSig.get();
      if (opts.rollout === 'random') {
        // rollout تصادفی نیازی به امنیت رمزنگاری ندارد — نتیجه فقط برای تجربهٔ کاربر است.
        // eslint-disable-next-line no-restricted-syntax -- rollout=random: تصادف غیرامنیتی UI (نه token).
        return Math.random() * 100 < pct;
      }
      const uid = ctx.userId ?? 'anonymous';
      return stableHashRollout(name, uid) < pct;
    }
    void variant;
    return true;
  };

  const computeVariant = (name: string): string | null => {
    const all = overrides.get();
    const raw: FlagValue | undefined = name in all ? all[name] : data[name];
    if (raw === undefined || raw === null || typeof raw === 'boolean') return null;
    return raw.variant ?? null;
  };

  const flagCache = new Map<string, ReadonlySignal<boolean>>();
  const variantCache = new Map<string, ReadonlySignal<string | null>>();

  const client: Flags = {
    flag(name: string, def = false): ReadonlySignal<boolean> {
      let sig = flagCache.get(name);
      if (!sig) {
        sig = computed(() => {
          tick.get();
          const exists = name in data || name in overrides.get();
          if (!exists && (globalThis as any).__ZENITH_DEV__ !== false && !def) {
            throw createReservedError('ZEN-2201', { details: { flag: name } });
          }
          return computeEnabled(name, def);
        }) as ReadonlySignal<boolean>;
        flagCache.set(name, sig);
      }
      return sig;
    },
    variant(name: string): ReadonlySignal<string | null> {
      let sig = variantCache.get(name);
      if (!sig) {
        sig = computed(() => {
          tick.get();
          return computeVariant(name);
        }) as ReadonlySignal<string | null>;
        variantCache.set(name, sig);
      }
      return sig;
    },
    setContext(next: FlagContext): void {
      contextSig.set({ ...contextSig.get(), ...next });
    },
    override(name: string, value: FlagValue): Cleanup {
      const all = overrides.get();
      const had = name in all;
      const prev = all[name];
      overrides.set({ ...all, [name]: value });
      let restored = false;
      return () => {
        if (restored) return;
        restored = true;
        const cur = overrides.get();
        const next: Record<string, FlagValue> = { ...cur };
        if (had) next[name] = prev as FlagValue;
        else delete next[name];
        overrides.set(next);
      };
    },
    async refresh(): Promise<void> {
      if (typeof opts.source !== 'function') return;
      try {
        const loaded = await opts.source(contextSig.get());
        data = { ...data, ...loaded };
        if (storage) storage.set(opts.storageKey, data);
        tick.set(tick.get() + 1);
      } catch (cause) {
        throw createReservedError('ZEN-2202', { cause });
      }
    },
    dispose(): void {
      flagCache.clear();
      variantCache.clear();
      overrides.set({});
      if (timerHandle !== undefined) clearTimeout(timerHandle);
    },
  };

  // زمان‌بندی refresh دوره‌ای.
  let timerHandle: ReturnType<typeof setTimeout> | undefined;
  if (opts.refreshInterval > 0 && typeof opts.source === 'function') {
    const loop = (): void => {
      timerHandle = setTimeout(async () => {
        try {
          await client.refresh();
        } catch {
          /* refresh خطا را throw نمی‌کنیم تا زمان‌بند نایستد؛ مصرف‌کننده می‌تواند subscribe کند */
        }
        loop();
      }, opts.refreshInterval);
      if (typeof timerHandle === 'object' && timerHandle !== null && 'unref' in timerHandle) {
        (timerHandle as unknown as { unref: () => void }).unref();
      }
    };
    loop();
  }

  if (typeof Symbol !== 'undefined' && Symbol.dispose) {
    (client as any)[Symbol.dispose] = () => client.dispose();
  }
  return client;
}

/**
 * #168: پلاگین رسمی `app.use(flagsPlugin(options))`.
 */
export function flagsPlugin(options: FlagsOptions) {
  return {
    name: 'zenith:flags',
    install(app: { provide?: (key: string | symbol, value: unknown) => void }) {
      const flags = createFlags(options);
      app?.provide?.('zenith:flags', flags);
      return () => flags.dispose();
    },
  };
}
