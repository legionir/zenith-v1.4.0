// @vitest-environment jsdom
// packages/schema/test/attr.test.ts
// #120 — مسیر مشترک خواندن attribute (parseJsonAttr/parseJsonValue/parseConfigAttr).
import { describe, it, expect, vi } from 'vitest';
import { parseJsonAttr, parseJsonValue, parseConfigAttr } from '../src/attr';
import { safeValidate, s, validate } from '../src';
import { ZenithError } from '@zenith/errors';

function el(attrs: Record<string, string>): HTMLElement {
  const node = document.createElement('div');
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

describe('#120 — attribute JSON helpers (shared path in @zenith/schema/attr)', () => {
  it('returns the fallback for a missing or empty attribute (no error reported)', () => {
    const onError = vi.fn();
    expect(parseJsonAttr(el({}), 'zen-chart-options', { fallback: { a: 1 }, onError })).toEqual({
      a: 1,
    });
    expect(
      parseJsonAttr(el({ 'zen-chart-options': '   ' }), 'zen-chart-options', {
        fallback: null,
        onError,
      }),
    ).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('parses valid JSON and reports ZEN-1003 once for broken JSON, returning the fallback', () => {
    const onError = vi.fn();
    expect(
      parseJsonAttr(el({ 'zen-chart-options': '{"type":"bar"}' }), 'zen-chart-options', {
        fallback: {},
      }),
    ).toEqual({ type: 'bar' });

    const result = parseJsonAttr(el({ 'zen-chart-options': '{oops' }), 'zen-chart-options', {
      fallback: { type: 'line' },
      onError,
    });
    expect(result).toEqual({ type: 'line' });
    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0][0] as ZenithError;
    expect(err).toBeInstanceOf(ZenithError);
    expect(err.code).toBe('ZEN-1003');
    expect(err.details?.attr).toBe('zen-chart-options');
    expect(err.docsUrl).toContain('ZEN-1003');
  });

  it('validates against a schema when given one: mismatch reports ZEN-1001 and keeps the fallback', () => {
    const onError = vi.fn();
    const schema = s.object({ retries: s.number({ min: 0 }) });
    const ok = parseJsonAttr(el({ 'zen-x': '{"retries":2}' }), 'zen-x', {
      fallback: { retries: 0 },
      schema,
      onError,
    });
    expect(ok).toEqual({ retries: 2 });
    expect(onError).not.toHaveBeenCalled();

    const bad = parseJsonAttr(el({ 'zen-x': '{"retries":"nope"}' }), 'zen-x', {
      fallback: { retries: 0 },
      schema,
      onError,
    });
    expect(bad).toEqual({ retries: 0 });
    expect((onError.mock.calls[0][0] as ZenithError).code).toBe('ZEN-1001');
  });

  it('parseJsonValue converts literals like the old inline coercion did', () => {
    expect(parseJsonValue('true')).toBe(true);
    expect(parseJsonValue('false')).toBe(false);
    expect(parseJsonValue('null')).toBeNull();
    expect(parseJsonValue('undefined')).toBeUndefined();
    expect(parseJsonValue('42')).toBe(42);
    expect(parseJsonValue('-1.5')).toBe(-1.5);
    expect(parseJsonValue('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonValue('[1,2]')).toEqual([1, 2]);
    expect(parseJsonValue('hello')).toBe('hello');
    expect(parseJsonValue(null)).toBeNull();
  });

  it('parseJsonValue keeps the raw string for broken JSON and reports the ZEN code', () => {
    const onError = vi.fn();
    expect(parseJsonValue('{broken', { onError })).toBe('{broken');
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as ZenithError).code).toBe('ZEN-1003');
    expect(parseJsonValue('[1,2', { onError })).toBe('[1,2');
  });

  it('parseConfigAttr stays strict: broken JSON throws ZEN-1003 instead of falling back', () => {
    const schema = s.object({ a: s.number({ min: 0 }) });
    expect(parseConfigAttr(el({ cfg: '{"a":1}' }), 'cfg', schema)).toEqual({ a: 1 });
    expect(() => parseConfigAttr(el({ cfg: '{oops' }), 'cfg', schema)).toThrowError(/ZEN-1003/);
  });

  it('is exported from the @zenith/schema/attr subpath and documented as the only attribute path', async () => {
    const mod = await import('../src/attr');
    expect(typeof mod.parseJsonAttr).toBe('function');
    expect(typeof mod.parseJsonValue).toBe('function');
    expect(typeof mod.parseConfigAttr).toBe('function');

    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'packages', 'schema', 'package.json'), 'utf8'),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((pkg as any).exports['./attr'].import).toBe('./dist/attr.js');
    const optional = s.object({ a: s.number({ min: 0 }) });
    expect(safeValidate(optional, { a: 1 }, { name: 'x' }).ok).toBe(true);
    expect(() => validate(optional, { a: 'x' as unknown as number }, { name: 'x' })).toThrow();
  });
});
