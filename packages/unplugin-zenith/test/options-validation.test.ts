// #52 — اعتبارسنجی گزینه‌های @zenith/unplugin-zenith در مرز ورودی
// (moved from vite-plugin in #164؛ DEFAULTS حالا superset یکپارچه است)
import { describe, it, expect } from 'vitest';
import { ZenithError } from '@zenith/errors';
import {
  zenithVite,
  transformHtml,
  UNPLUGIN_OPTIONS_DEFAULTS,
  COMPILE_OPTIONS_DEFAULTS,
  resolveUnpluginOptions,
  resolveCompileOptions,
} from '../src/index';

function catchError(fn: () => unknown): ZenithError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ZenithError);
    return err as ZenithError;
  }
  throw new Error('Expected function to throw ZenithError');
}

async function catchAsyncError(fn: () => Promise<unknown>): Promise<ZenithError> {
  try {
    await fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ZenithError);
    return err as ZenithError;
  }
  throw new Error('Expected async function to reject with ZenithError');
}

describe('@zenith/unplugin-zenith options validation (#52, unified in #164)', () => {
  it('exports frozen DEFAULTS and resolves the unified superset defaults', () => {
    expect(Object.isFrozen(UNPLUGIN_OPTIONS_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(COMPILE_OPTIONS_DEFAULTS)).toBe(true);

    expect(resolveCompileOptions()).toEqual({
      enabled: true,
      include: ['**/*.html'],
      exclude: ['node_modules/**'],
      strict: false,
    });

    expect(resolveUnpluginOptions()).toEqual({
      include: ['**/*.html'],
      exclude: ['node_modules/**'],
      strict: false,
      compile: {
        enabled: true,
        include: ['**/*.html'],
        exclude: ['node_modules/**'],
        strict: false,
      },
      meta: false,
      watchPatterns: [],
      autoInjectDevtools: true,
      enableHtmlHMR: true,
    });
  });

  it('rejects invalid types, empty pattern items, and unknown keys on zenithVite()', () => {
    const typeErr = catchError(() => zenithVite({ autoInjectDevtools: 'false' as any }));
    expect(typeErr.code).toBe('ZEN-1001');
    expect((typeErr.details as any).path).toBe('autoInjectDevtools');

    const emptyPatternErr = catchError(() => zenithVite({ watchPatterns: [''] }));
    expect(emptyPatternErr.code).toBe('ZEN-1004');
    expect((emptyPatternErr.details as any).path).toBe('watchPatterns.0');

    const nestedCompileErr = catchError(() => zenithVite({ compile: { strict: 'yes' as any } }));
    expect(nestedCompileErr.code).toBe('ZEN-1001');
    expect((nestedCompileErr.details as any).path).toBe('compile.strict');

    const unknownKeyErr = catchError(() => zenithVite({ hmr: true } as any));
    expect(unknownKeyErr.code).toBe('ZEN-1002');
    expect((unknownKeyErr.details as any).path).toBe('hmr');
  });

  it('validates CompileOptions at transformHtml() entry boundary', async () => {
    const err = await catchAsyncError(() =>
      transformHtml('<div>hello</div>', 'index.html', { unknownOption: 1 } as any),
    );
    expect(err.code).toBe('ZEN-1002');
    expect((err.details as any).path).toBe('unknownOption');
  });
});
