import { describe, expect, it } from 'vitest';
import { buildPlatform, needsBrowserGlobal } from '../lib/build-target.mjs';

describe('per-entry target ownership (#57)', () => {
  it('keeps the Node Playwright root separate from its browser handshake', () => {
    const manifest = { name: '@zenith/testing-e2e', zenith: { target: 'node', entryTargets: { './browser': 'browser' } } };
    expect(buildPlatform(manifest)).toBe('node');
    expect(buildPlatform(manifest, './browser')).toBe('browser');
    expect(needsBrowserGlobal(manifest, './browser')).toBe(false);
  });
  it('does not generate the umbrella global footer for an unrelated browser subpath', () => {
    expect(needsBrowserGlobal({ name: 'zenith' }, './browser')).toBe(true);
    expect(needsBrowserGlobal({ name: 'zenith' }, '.')).toBe(false);
    expect(needsBrowserGlobal({ name: '@zenith/fixture' }, './browser')).toBe(false);
  });
  it('selects neutral/browser/worker targets and preserves documented legacy Node hosts', () => {
    expect(buildPlatform({ zenith: { target: 'universal' } })).toBe('neutral');
    expect(buildPlatform({ zenith: { target: 'browser' } })).toBe('browser');
    expect(buildPlatform({ zenith: { target: 'worker' } })).toBe('browser');
    expect(buildPlatform({}, '.', 'ssr')).toBe('node');
  });
  it('rejects unknown targets instead of silently compiling a fallback', () => {
    expect(() => buildPlatform({ zenith: { target: 'typo' } })).toThrow('Unsupported build target');
    expect(() => buildPlatform({ zenith: { target: 'node', entryTargets: { './browser': 'typo' } } }, './browser')).toThrow('Unsupported build target');
  });
});

it('overrides the legacy SSR Node host only for its explicit Edge subpath', () => {
  const manifest = { name: '@zenith/ssr', zenith: { target: 'node', entryTargets: { './edge': 'worker' } } };
  expect(buildPlatform(manifest, '.', 'ssr')).toBe('node'); expect(buildPlatform(manifest, './edge', 'ssr')).toBe('browser'); expect(needsBrowserGlobal(manifest, './edge')).toBe(false);
});
