// packages/theme/src/theme.ts
//
// @zenith/theme (#161) — مدیر تم L2:
//   حالت روشن/تاریک/سیستم، جهت dir، توکن‌های CSS، همگام‌سازی بین تب‌ها
//   و اسکریپت init برای جلوگیری از flash تم در بارگذاری اول.
//
// لایه: L2 (وابستگی: shared, storage, schema؛ peer: state, scheduler).

import { signal, computed, effect, type Signal, type ReadonlySignal } from '@zenith/state';
import { createStorage, type ZenithStorage } from '@zenith/storage';
import { createReservedError } from '@zenith/errors';
import type { Disposable } from '@zenith/shared';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeDir = 'ltr' | 'rtl';

export interface ThemeTokenSet {
  /** مقدارهای هر توکن در حالت light (مثل --zen-bg: '#ffffff') */
  light: Record<string, string>;
  /** مقدارهای هر توکن در حالت dark */
  dark: Record<string, string>;
}

export interface ThemeOptions {
  defaultMode?: ThemeMode;
  storageKey?: string;
  attribute?: 'data-theme' | 'class';
  /** لیست نام‌های توکن (بدون پیشوند) با مقدارهای light/dark */
  tokens?: ThemeTokenSet;
  tokenPrefix?: string;
  dir?: 'auto' | ThemeDir;
  defaultDir?: ThemeDir;
  /** اگر true، هنگام تغییر mode، transition موقتاً غیرفعال می‌شود تا flash رنگی نباشد */
  transitionDisabledOnChange?: boolean;
  /** ذخیره در cookie (برای SSR بدون flash) به‌جای localStorage */
  cookie?: boolean;
  storage?: ZenithStorage;
  /** document پنجرهٔ هدف (برای تست/SSR) */
  document?: Document;
}

export interface Theme extends Disposable {
  readonly mode: Signal<ThemeMode>;
  readonly resolved: ReadonlySignal<'light' | 'dark'>;
  readonly dir: Signal<ThemeDir>;
  setMode(mode: ThemeMode): void;
  toggle(): void;
  /** مقدار token در حالت resolved فعلی (بدون پیشوند css) */
  tokens(name: string): string;
  dispose(): void;
}

/**
 * #53 / #161: پیش‌فرض‌های منجمد تم.
 * @default { defaultMode: 'system', storageKey: 'zen.theme', attribute: 'data-theme', tokenPrefix: '--zen', dir: 'auto', transitionDisabledOnChange: true, cookie: false }
 * @since 1.4.0
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  defaultMode: 'system' as ThemeMode,
  storageKey: 'zen.theme',
  attribute: 'data-theme' as const,
  tokenPrefix: '--zen',
  dir: 'auto' as const,
  defaultDir: 'ltr' as ThemeDir,
  transitionDisabledOnChange: true,
  cookie: false,
});

function resolveSystemMode(doc?: Document): 'light' | 'dark' {
  const view = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  if (view && typeof view.matchMedia === 'function') {
    try {
      return view.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      /* fall through */
    }
  }
  return 'light';
}

function readCookieMode(name: string, doc?: Document): ThemeMode | null {
  const d = doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (!d) return null;
  const match = d.cookie.match(new RegExp(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}=([^;]*)`));
  const v = match?.[1];
  return v === 'light' || v === 'dark' ? v : null;
}

function writeCookieMode(name: string, value: ThemeMode, doc?: Document): void {
  const d = doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (!d) return;
  // max-age یک سال؛ path ریشه تا SSR همهٔ مسیرها را ببیند.
  d.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * #161: ساخت مدیر تم واکنشی.
 *
 * رفتار:
 *   - mode = 'system' ⇒ resolved از prefers-color-scheme خوانده و با matchMedia
 *     ردیابی می‌شود؛
 *   - تغییر mode روی documentElement اعمال می‌شود (data-theme|class + tokens +
 *     dir) و در localStorage یا cookie ذخیره می‌گردد؛
 *   - رویداد storage بین تب‌ها حالت را همگام می‌کند.
 */
export function createTheme(options: ThemeOptions = {}): Theme {
  const opts = { ...DEFAULTS, ...options };
  const doc = options.document ?? (typeof document !== 'undefined' ? document : undefined);

  let storage: ZenithStorage | null = null;
  if (!opts.cookie) {
    try {
      storage = options.storage ?? createStorage({ namespace: '' });
      // دسترس‌پذیری واقعی را با خواندن تست می‌کنیم (Private mode → throw).
      storage.get(opts.storageKey);
    } catch (cause) {
      throw createReservedError('ZEN-2002', { cause });
    }
  }

  const initial: ThemeMode =
    (opts.cookie
      ? readCookieMode(opts.storageKey, doc)
      : (storage?.get(opts.storageKey) as ThemeMode | null)) ??
    opts.defaultMode;

  const mode: Signal<ThemeMode> = signal(initial);
  const dir: Signal<ThemeDir> = signal(
    opts.dir === 'auto'
      ? opts.defaultDir
      : (opts.dir as ThemeDir),
  );
  const resolved: ReadonlySignal<'light' | 'dark'> = computed(() =>
    mode.get() === 'system' ? resolveSystemMode(doc) : (mode.get() as 'light' | 'dark'),
  );

  const cssVar = (name: string): string => `${opts.tokenPrefix}-${name}`;
  const tokenValue = (name: string, modeKey: 'light' | 'dark'): string => {
    const set = opts.tokens?.[modeKey];
    if (!set || !(name in set)) {
      throw createReservedError('ZEN-2001', { details: { token: name } });
    }
    return set[name]!;
  };

  let disposeMediaWatch: (() => void) | null = null;
  let stopSync: (() => void) | null = null;

  const apply = (value: 'light' | 'dark'): void => {
    if (!doc) return;
    const root = doc.documentElement;
    if (opts.transitionDisabledOnChange) {
      const css = doc.createElement('style');
      css.textContent = '*{transition:none!important}';
      doc.head?.appendChild(css);
      // در فریم بعد حذف می‌شود تا transitionها برگردند.
      const raf = doc.defaultView?.requestAnimationFrame;
      if (typeof raf === 'function') raf(() => css.remove());
      else setTimeout(() => css.remove(), 0);
    }

    if (opts.attribute === 'class') {
      const other = value === 'dark' ? 'light' : 'dark';
      root.classList.remove(other);
      root.classList.add(value);
    } else {
      root.setAttribute('data-theme', value);
    }
    if (opts.dir !== 'auto') root.setAttribute('dir', dir.get());
    else if (opts.defaultDir) root.setAttribute('dir', dir.get());

    if (opts.tokens) {
      for (const name of Object.keys(opts.tokens.light)) {
        try {
          root.style.setProperty(cssVar(name), tokenValue(name, value));
        } catch {
          /* توکن‌های نامعتبر فقط در light تعریف شده‌اند ⇒ ZEN-2001 هنگام tokens(name) */
        }
      }
    }

    if (opts.cookie) writeCookieMode(opts.storageKey, value, doc);
    else storage?.set(opts.storageKey, mode.get());
  };

  // اعمال اولیه همگام با resolved (قبل از فریم رنگ).
  apply(resolved.get());

  const disposeEffect = effect(() => {
    const value = resolved.get();
    apply(value);
  });

  // watch prefers-color-scheme هنگام mode: 'system'
  const view = doc?.defaultView ?? (typeof window !== 'undefined' ? window : null);
  if (view && typeof view.matchMedia === 'function') {
    const mql = view.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => {
      if (mode.get() === 'system') apply(resolveSystemMode(doc));
    };
    mql.addEventListener?.('change', onChange);
    disposeMediaWatch = () => mql.removeEventListener?.('change', onChange);
  }

  // همگام‌سازی بین تب‌ها (storage event فقط برای localStorage کار می‌کند).
  if (!opts.cookie && typeof window !== 'undefined') {
    const onStorage = (ev: StorageEvent): void => {
      if (ev.key && ev.key !== opts.storageKey) return;
      const next = ev.newValue as ThemeMode | null;
      if (next === 'light' || next === 'dark' || next === 'system') {
        mode.set(next);
      }
    };
    window.addEventListener('storage', onStorage);
    stopSync = () => window.removeEventListener('storage', onStorage);
  }

  const instance: Theme = {
    mode,
    resolved,
    dir,
    setMode(next: ThemeMode): void {
      mode.set(next);
    },
    toggle(): void {
      mode.set(resolved.get() === 'dark' ? 'light' : 'dark');
    },
    tokens(name: string): string {
      const value = tokenValue(name, resolved.get());
      return doc ? `${cssVar(name)}` : value;
    },
    dispose(): void {
      disposeEffect();
      disposeMediaWatch?.();
      stopSync?.();
    },
  };
  if (typeof Symbol !== 'undefined' && Symbol.dispose) {
    (instance as any)[Symbol.dispose] = () => instance.dispose();
  }
  return instance;
}

/**
 * #161: اسکریپت inline `<head>` برای اعمال تم پیش از اولین رنگ (بدون flash).
 *
 * بهترین نقطه: قبل از هر stylesheet بدنه و با CSP nonce پروژه.
 */
export function themeInitScript(opts?: {
  nonce?: string;
  storageKey?: string;
  attribute?: 'data-theme' | 'class';
  cookie?: boolean;
  defaultMode?: ThemeMode;
  defaultDir?: ThemeDir;
}): string {
  const key = JSON.stringify(opts?.storageKey ?? DEFAULTS.storageKey);
  const attr = JSON.stringify(opts?.attribute ?? DEFAULTS.attribute);
  const cookie = opts?.cookie ? 'true' : 'false';
  const defMode = JSON.stringify(opts?.defaultMode ?? DEFAULTS.defaultMode);
  const defDir = JSON.stringify(opts?.defaultDir ?? DEFAULTS.defaultDir);
  const nonceAttr = opts?.nonce ? ` nonce="${opts.nonce}"` : '';
  // بدون template literal بیرونی — متن اسکریپت به‌صورت خالص ساخته می‌شود.
  const body = [
    '(function(){',
    'try{',
    `var k=${key},m=${cookie}?document.cookie.match(new RegExp("(?:^|;\\\\s*)"+k+"=([^;]*)")):null,`,
    'v=m?m[1]:null;',
    `if(!v&&window.localStorage){v=localStorage.getItem(k)}v=v||${defMode};`,
    'var d=v;',
    'if(v==="system"){d=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}',
    `if(${attr}==="class"){document.documentElement.classList.add(d)}`,
    'else{document.documentElement.setAttribute("data-theme",d)}',
    `document.documentElement.setAttribute("dir",${defDir})`,
    '}catch(e){document.documentElement.setAttribute("data-theme","light")}',
    '})()',
  ].join('');
  // SEC: جلوگیری از خروج زودهنگام از <script> اگر key تزریق شده باشد.
  return `<script${nonceAttr}>${body.replace(/<\//g, '<\\/')}</script>`;
}

/**
 * #161: پلاگین رسمی `app.use(themePlugin(options))`.
 */
export function themePlugin(options: ThemeOptions = {}) {
  return {
    name: 'zenith:theme',
    install(app: { provide?: (key: string | symbol, value: unknown) => void; dispose?: () => void }) {
      const theme = createTheme(options);
      app?.provide?.('zenith:theme', theme);
      return () => theme.dispose();
    },
  };
}
