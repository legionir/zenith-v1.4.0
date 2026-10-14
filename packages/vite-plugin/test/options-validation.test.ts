// #52 — اعتبارسنجی گزینه‌های @zenith/vite-plugin در مرز ورودی (ZenithPluginOptions / CompileOptions)
import { describe, it, expect } from 'vitest';
import { ZenithError } from '@zenith/errors';
import {
  zenithPlugin,
  transformHtml,
  ZENITH_PLUGIN_OPTIONS_DEFAULTS,
  COMPILE_OPTIONS_DEFAULTS,
  resolveZenithPluginOptions,
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

describe('@zenith/vite-plugin options validation (#52)', () => {
  it('exports frozen DEFAULTS and resolves defaults for ZenithPluginOptions and CompileOptions', () => {
    expect(Object.isFrozen(ZENITH_PLUGIN_OPTIONS_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(COMPILE_OPTIONS_DEFAULTS)).toBe(true);

    expect(resolveCompileOptions()).toEqual({
      enabled: true,
      include: ['**/*.html'],
      exclude: ['node_modules/**'],
      strict: false,
    });

    expect(resolveZenithPluginOptions()).toEqual({
      watchPatterns: [],
      autoInjectDevtools: true,
      enableHtmlHMR: true,
      compile: {
        enabled: true,
        include: ['**/*.html'],
        exclude: ['node_modules/**'],
        strict: false,
      },
    });
  });

  it('rejects invalid types, empty watchPatterns items, and unknown keys on zenithPlugin()', () => {
    const typeErr = catchError(() => zenithPlugin({ autoInjectDevtools: 'false' as any }));
    expect(typeErr.code).toBe('ZEN-1001');
    expect((typeErr.details as any).path).toBe('autoInjectDevtools');

    const emptyPatternErr = catchError(() => zenithPlugin({ watchPatterns: [''] }));
    expect(emptyPatternErr.code).toBe('ZEN-1004');
    expect((emptyPatternErr.details as any).path).toBe('watchPatterns.0');

    const nestedCompileErr = catchError(() => zenithPlugin({ compile: { strict: 'yes' as any } }));
    expect(nestedCompileErr.code).toBe('ZEN-1001');
    expect((nestedCompileErr.details as any).path).toBe('compile.strict');

    const unknownKeyErr = catchError(() => zenithPlugin({ hmr: true } as any));
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
