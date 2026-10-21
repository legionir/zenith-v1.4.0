// #142 — مهاجرت schema به @zenith/schema: سه API قدیمی form با همان امضا
// می‌مانند و deprecate می‌شوند (alias + ZEN-DEPR-016..018؛ SPEC §۲.۲ «مهاجرت»).
// قرمز قبل از رفع: هشداری منتشر نشده و کدها در رجیستری errors نیستند.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetDeprecationWarnings } from '@zenith/errors';

// zod نصب نیست — همان دونگی safeParse که form قدیمی می‌پذیرفت.
describe('form schema adapters are deprecated aliases (#142)', () => {
  let calls: string[];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    calls = [];
    spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      calls.push(args.map(String).join(' '));
    });
    resetDeprecationWarnings();
  });
  afterEach(() => {
    spy.mockRestore();
    resetDeprecationWarnings();
  });

  it('fromZod warns ZEN-DEPR-016 once but still returns a FormStore', async () => {
    const { fromZod } = await import('../src/index');
    const fakeZod = {
      safeParse: (d: unknown) => ({
        success: typeof d === 'object' && d !== null,
        error: { issues: [{ path: ['email'], message: 'expected string' }] },
      }),
    };
    const store1 = fromZod(fakeZod as never, { email: { initial: '', label: 'E' } });
    fromZod(fakeZod as never, { email: { initial: '' } });
    expect(store1).toBeTruthy();
    expect(typeof (store1 as { getValues?: unknown }).getValues).toBe('function');
    expect(calls.filter((c) => c.includes('ZEN-DEPR-016'))).toHaveLength(1);
    expect(calls.join('\n')).toContain('@zenith/schema/zod');
  });

  it('validateWithZod warns ZEN-DEPR-017 and keeps Promise<boolean> behavior', async () => {
    const { createForm, validateWithZod } = await import('../src/index');
    const form = createForm({ a: { initial: 'x' } });
    const fakeZod = {
      safeParse: () => ({ success: false, error: { issues: [{ path: [], message: 'bad' }] } }),
    };
    const ok = await validateWithZod(form, fakeZod as never);
    expect(ok).toBe(false);
    expect(calls.filter((c) => c.includes('ZEN-DEPR-017'))).toHaveLength(1);
    expect(calls.join('\n')).toContain('@zenith/schema/zod');
  });

  it('fromJsonSchema warns ZEN-DEPR-018 and keeps FormStore behavior', async () => {
    const { fromJsonSchema } = await import('../src/index');
    const store = fromJsonSchema(
      {
        type: 'object',
        properties: { name: { type: 'string', minLength: 2 } },
        required: ['name'],
      },
      { name: 'ab' },
    );
    expect(typeof (store as { getValues?: unknown }).getValues).toBe('function');
    expect(calls.filter((c) => c.includes('ZEN-DEPR-018'))).toHaveLength(1);
    expect(calls.join('\n')).toContain('@zenith/schema/json-schema');
  });

  it('DEPRECATION_CODES in @zenith/errors registers 016..018 with removedIn 2.0.0', async () => {
    const { DEPRECATION_CODES } = await import('@zenith/errors');
    expect(DEPRECATION_CODES['ZEN-DEPR-016'].replacement).toContain('@zenith/schema');
    expect(DEPRECATION_CODES['ZEN-DEPR-017'].replacement).toContain('@zenith/schema/zod');
    expect(DEPRECATION_CODES['ZEN-DEPR-018'].replacement).toContain('@zenith/schema/json-schema');
    for (const c of ['ZEN-DEPR-016', 'ZEN-DEPR-017', 'ZEN-DEPR-018']) {
      expect(DEPRECATION_CODES[c].removedIn).toBe('2.0.0');
    }
  });
});
