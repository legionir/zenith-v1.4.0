import { expect, it } from 'vitest';
import { releaseMetadata } from '../lib/release-tags.mjs';
it('does not silently classify untagged or deprecated-only symbols as public', () => {
  expect(releaseMetadata([])).toEqual({ tag: 'unclassified', deprecated: false });
  expect(releaseMetadata(['deprecated'])).toEqual({ tag: 'unclassified', deprecated: true });
});
it('keeps lifecycle and release level independent', () => {
  expect(releaseMetadata(['public', 'deprecated'])).toEqual({ tag: 'public', deprecated: true });
  expect(releaseMetadata([{ name: 'beta' }, { name: 'deprecated' }])).toEqual({ tag: 'beta', deprecated: true });
  expect(releaseMetadata(['internal', 'public']).tag).toBe('conflicting');
});
