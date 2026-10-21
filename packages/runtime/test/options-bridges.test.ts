// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resetDeprecationWarnings, runGlobalResets } from '@zenith/errors';
import { setHostPrinter } from '@zenith/errors/internal';
import { onError } from '@zenith/state';
import { registerCustomDirective, listCustomDirectives, getCustomDirective, hasCustomDirective, unregisterCustomDirective } from '../src';
import { clearCustomDirectivesInternal, getCustomDirectiveRegistration } from '../src/custom-directives';
import { assertParity, reportParityDivergence, setStrictParity, clearParityWarnings } from '../src/parity-check';
const diagnostics: string[] = []; const divergences: string[] = []; let releasePrinter: () => void; let releaseErrors: () => void;
const getDeprecationWarnings = () => diagnostics.flatMap(message => message.match(/ZEN-DEPR-\d{3}/g) ?? []);
beforeEach(() => { diagnostics.length = 0; divergences.length = 0; releaseErrors = onError(error => { if (error.message.startsWith('Parity divergence detected')) divergences.push(error.message); }); releasePrinter = setHostPrinter((_severity, title) => { diagnostics.push(title); }); resetDeprecationWarnings(); clearParityWarnings(); clearCustomDirectivesInternal(); });
afterEach(() => { releaseErrors(); releasePrinter(); clearCustomDirectivesInternal(); setStrictParity(false); clearParityWarnings(); resetDeprecationWarnings(); vi.restoreAllMocks(); });
it('accepts canonical options without a compatibility warning and resolves the default attribute', () => {
  const handler = vi.fn(); const stop = registerCustomDirective('ZEN-CONFIG', { handler });
  expect(getCustomDirectiveRegistration('ZEN-CONFIG')?.attributeName).toBe('config'); expect(getCustomDirective('zen-config')).toBe(handler);
  expect(getDeprecationWarnings()).not.toContain('ZEN-DEPR-086'); stop(); expect(hasCustomDirective('zen-config')).toBe(false);
});
it('keeps replacement ownership even when the callback identity is reused', () => {
  const handler = vi.fn(), stale = registerCustomDirective('zen-token', { handler, attributeName: 'first' });
  const current = registerCustomDirective('ZEN-TOKEN', { handler, attributeName: 'second' });
  stale(); stale(); expect(getCustomDirectiveRegistration('zen-token')?.attributeName).toBe('second');
  current(); expect(hasCustomDirective('zen-token')).toBe(false);
});
it('returns a detached lowercase inventory and preserves explicit unregister semantics', () => {
  registerCustomDirective('ZEN-A', { handler: vi.fn() }); registerCustomDirective('zen-b', { handler: vi.fn() });
  const names = listCustomDirectives(); names.length = 0; expect(listCustomDirectives()).toEqual(['zen-a', 'zen-b']);
  expect(unregisterCustomDirective('ZEN-A')).toBe(true); expect(unregisterCustomDirective('zen-a')).toBe(false); expect(listCustomDirectives()).toEqual(['zen-b']);
});
it('rejects malformed canonical configuration without mutating the registry', () => {
  // @ts-expect-error Deliberate JavaScript boundary misuse.
  expect(() => registerCustomDirective('zen-invalid', { handler: 1 })).toThrow();
  // @ts-expect-error Canonical attributes must be strings.
  expect(() => registerCustomDirective('zen-invalid', { handler: vi.fn(), attributeName: false })).toThrow();
  expect(hasCustomDirective('zen-invalid')).toBe(false);
});
it('retains legacy default-parameter and falsy-attribute fallback semantics with one warning', () => {
  const handler = vi.fn(); registerCustomDirective('zen-legacy', handler, ''); registerCustomDirective('zen-legacy-2', handler);
  expect(getCustomDirectiveRegistration('zen-legacy')?.attributeName).toBe('config'); expect(getCustomDirectiveRegistration('zen-legacy-2')?.attributeName).toBe('config');
  expect(getDeprecationWarnings().filter(code => code === 'ZEN-DEPR-086')).toHaveLength(1);
});
it('validates canonical parity options while preserving arbitrary unknown operands', () => {
  expect(assertParity('bind', { runtimeValue: undefined, expectedCompilerValue: undefined, description: 'unset' })).toBe(true);
  expect(assertParity('bind', { runtimeValue: { nested: [1] }, expectedCompilerValue: { nested: [1] }, description: 'structured' })).toBe(true);
  // @ts-expect-error Deliberate malformed canonical description.
  expect(() => assertParity('bind', { runtimeValue: 1, expectedCompilerValue: 1, description: 4 })).toThrow();
  // @ts-expect-error Deliberate malformed canonical hint.
  expect(() => reportParityDivergence('bind', { description: 'wrong', hint: false })).toThrow();
  expect(getDeprecationWarnings()).not.toContain('ZEN-DEPR-087'); expect(getDeprecationWarnings()).not.toContain('ZEN-DEPR-088');
});
it('preserves the legacy operand object without treating it as a canonical option bag', () => {
  const value = { runtimeValue: 'payload', description: 'data, not options' };
  expect(assertParity('bind', value, value, 'legacy')).toBe(true); expect(getDeprecationWarnings()).toContain('ZEN-DEPR-088');
});
it('does not send explicit legacy arity through canonical validation', () => {
  setStrictParity(false);
  expect(() => reportParityDivergence('legacy-arity', undefined as unknown as string, 'legacy hint')).not.toThrow();
  expect(getDeprecationWarnings()).toContain('ZEN-DEPR-087'); expect(divergences).toEqual([]);
});
it('preserves strict-mode opt-in and throttling without introducing throw semantics or a second bridge warning', () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(10_000);
  expect(assertParity('text', 1, 2, 'silent while disabled')).toBe(false); expect(divergences).toEqual([]);
  setStrictParity(true);
  expect(assertParity('text', 1, 2, 'value')).toBe(false);
  expect(getDeprecationWarnings()).toContain('ZEN-DEPR-088'); expect(getDeprecationWarnings()).not.toContain('ZEN-DEPR-087');
  reportParityDivergence('text', { description: 'throttled' }); expect(divergences).toHaveLength(1);
  now.mockReturnValue(16_000);
  expect(() => reportParityDivergence('text', 'legacy warning, not exception')).not.toThrow();
  expect(divergences).toHaveLength(2); expect(getDeprecationWarnings()).toContain('ZEN-DEPR-087');
});
it('participates in the global reset hook without exposing internal registry functions at the root', () => {
  registerCustomDirective('zen-reset-owner', { handler: vi.fn() }); runGlobalResets(); expect(listCustomDirectives()).toEqual([]);
});
