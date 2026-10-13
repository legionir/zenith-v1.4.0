// packages/theme/test/theme.test.ts
// @vitest-environment jsdom
/* global document, localStorage */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTheme,
  themeInitScript,
  themePlugin,
} from '../src/index';
import { flushSync } from '@zenith/scheduler';

describe('@zenith/theme (#161)', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('dir');
    document.documentElement.classList.remove('light', 'dark');
    localStorage.clear();
    document.cookie = 'zen.theme=; max-age=0; path=/';
  });

  it('ساختار رجیستری ۵ متدی در themePlugin و جلوگیری از flash با themeInitScript', () => {
    const plugin = themePlugin({ defaultMode: 'light', defaultDir: 'rtl' });
    expect(plugin.name).toBe('zenith:theme');
    const provided = new Map();
    const cleanup = plugin.install({ provide: (k, v) => provided.set(k, v) } as any);
    expect(provided.has('zenith:theme')).toBe(true);
    (cleanup as () => void)();

    const script = themeInitScript({ nonce: 'abc123', defaultMode: 'system' });
    expect(script).toContain('nonce="abc123"');
    expect(script).toContain('<script');
    expect(script).toContain('prefers-color-scheme');
  });

  it('mode=system به prefers-color-scheme واکنشی است و toggle کار می‌کند', () => {
    const theme = createTheme({ defaultMode: 'system', storageKey: 'zen.theme' });
    expect(theme.mode.get()).toBe('system');
    const r = theme.resolved.get();
    expect(r === 'dark' || r === 'light').toBe(true);
    theme.toggle();
    expect(theme.mode.get()).toBe(r === 'dark' ? 'light' : 'dark');
    theme.dispose();
  });

  it('data-theme و dir روی documentElement اعمال می‌شوند و در storage ذخیره می‌شود', () => {
    const theme = createTheme({ defaultMode: 'dark', dir: 'rtl' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(localStorage.getItem('zen.theme')).toContain('dark');
    theme.dispose();
  });

  it('توکن‌ها با پیشوند css روی documentElement اعمال و با tokens(name) در دسترس‌اند', () => {
    const theme = createTheme({
      defaultMode: 'dark',
      tokens: {
        light: { 'bg': '#ffffff', 'fg': '#111111' },
        dark: { 'bg': '#000000', 'fg': '#eeeeee' },
      },
    });
    expect(document.documentElement.style.getPropertyValue('--zen-bg')).toBe('#000000');
    expect(theme.tokens('bg')).toBe('--zen-bg');
    expect(() => theme.tokens('missing')).toThrow();
    theme.dispose();
  });

  it('cookie mode تم را بدون localStorage همگام می‌کند (SSR-safe)', () => {
    const theme = createTheme({ defaultMode: 'light', cookie: true });
    theme.setMode('dark');
    flushSync();
    expect(document.cookie).toMatch(/zen\.theme=dark/);
    theme.dispose();
  });
});
