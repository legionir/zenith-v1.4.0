import { expect, it } from 'vitest';
import { patch } from '../src/patch';
it('restores a configurable read-only descriptor instead of depending on assignment', () => {
  const original = () => {}, target = {}; Object.defineProperty(target, 'fetch', { value: original, writable: false, enumerable: false, configurable: true }); const before = Object.getOwnPropertyDescriptor(target, 'fetch');
  const first = () => {}, second = () => {}, a = patch(target, 'fetch', () => first), b = patch(target, 'fetch', () => second); a(); expect(Reflect.get(target, 'fetch')).toBe(second); b(); expect(Object.getOwnPropertyDescriptor(target, 'fetch')).toEqual(before);
});
it('does not invoke an accessor setter to install or restore a configurable patch', () => {
  let setters = 0; const original = () => {}, target = {}; Object.defineProperty(target, 'fetch', { get: () => original, set: () => { setters++; }, configurable: true }); const before = Object.getOwnPropertyDescriptor(target, 'fetch'), release = patch(target, 'fetch', () => () => {}); release(); expect(setters).toBe(0); expect(Object.getOwnPropertyDescriptor(target, 'fetch')).toEqual(before);
});
it('does not retain a failed installation above an existing patch lease', () => {
  const original = () => {}, first = () => {}, target = { fetch: original }, release = patch(target, 'fetch', () => first); Object.defineProperty(target, 'fetch', { configurable: false, writable: false }); expect(() => patch(target, 'fetch', () => () => {})).toThrow(); expect(target.fetch).toBe(first); expect(() => release()).toThrow();
});
it('does not reclaim a foreign descriptor installed while an owner is active', () => {
  const target = { fetch: () => {} }, release = patch(target, 'fetch', () => () => {}), foreign = () => {}; Object.defineProperty(target, 'fetch', { get: () => foreign, configurable: true, enumerable: false }); const before = Object.getOwnPropertyDescriptor(target, 'fetch'); release(); expect(Object.getOwnPropertyDescriptor(target, 'fetch')).toEqual(before);
});
it('removes only its own property when patching an inherited capability', () => {
  const original = () => {}, target = Object.create({ fetch: original }) as { fetch: () => void }; const release = patch(target, 'fetch', () => () => {}); release(); expect(Object.hasOwn(target, 'fetch')).toBe(false); expect(target.fetch).toBe(original);
});
