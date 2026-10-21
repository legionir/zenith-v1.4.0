// #112 (DX) — هر ZenithError لینک مستندات دارد و چاپ خطا آن را نشان می‌دهد.
import { describe, it, expect } from 'vitest';
import {
  ZenithError,
  ErrorCode,
  createReservedError,
  developerError,
  errorDocsUrl,
  toZenithError,
  resourceHttpError,
  variableNotDefinedError,
  deprecate,
  resetDeprecationWarnings,
  RESERVED_ERROR_CODES,
} from '../src/index';

describe('#112 docsUrl on every error', () => {
  it('derives docsUrl from the code when the caller does not pass one', () => {
    const err = new ZenithError({
      code: ErrorCode.RESOURCE_HTTP_ERROR,
      category: 'Network',
      message: 'boom',
    });
    expect(err.docsUrl).toBe('https://zenith.dev/errors/ZEN-202');
    expect(err.toJSON().docsUrl).toBe('https://zenith.dev/errors/ZEN-202');
  });

  it('respects an explicit docsUrl override', () => {
    const err = new ZenithError({
      code: 'ZEN-901',
      category: 'Internal',
      message: 'x',
      docsUrl: 'https://example.test/custom',
    });
    expect(err.docsUrl).toBe('https://example.test/custom');
  });

  it('prints the documentation link in toUserString()', () => {
    const err = new ZenithError({
      code: ErrorCode.EXPRESSION_SYNTAX_ERROR,
      category: 'Expression',
      message: 'bad expression',
      suggestion: 'fix it',
    });
    const text = err.toUserString();
    expect(text).toContain('📖 مستندات: https://zenith.dev/errors/ZEN-004');
    expect(text).toContain('💡 پیشنهاد: fix it');
  });

  it('every catalog code resolves to a stable docs url', () => {
    for (const code of Object.keys(RESERVED_ERROR_CODES)) {
      expect(errorDocsUrl(code)).toBe(`https://zenith.dev/errors/${code}`);
      expect(createReservedError(code).docsUrl).toBe(errorDocsUrl(code));
    }
  });

  it('factory helpers and wrappers also carry docsUrl', () => {
    const errors = [
      developerError('misuse'),
      toZenithError(new RangeError('plain')),
      resourceHttpError('/api/x', 500, 'Server Error'),
      variableNotDefinedError('missing', []),
    ];
    for (const err of errors) {
      expect(err.docsUrl).toMatch(/^https:\/\/zenith\.dev\/errors\/ZEN-/);
      expect(err.docsUrl).toContain(err.code);
    }
  });

  it('deprecation warnings link their own docs page', () => {
    resetDeprecationWarnings();
    const seen: string[] = [];
    const original = globalThis.console;
    const fake = {
      ...original,
      warn: (...args: unknown[]) => {
        seen.push(args.map(String).join(' '));
      },
    };
    (globalThis as { console: Console }).console = fake as unknown as Console;
    try {
      deprecate('ZEN-DEPR-001', 'processVirtualList', 'createVirtualList');
    } finally {
      (globalThis as { console: Console }).console = original;
    }
    expect(seen.join('\n')).toContain('ZEN-DEPR-001');
  });
});
