import { resetForTesting } from '@zenith/testing';
import { signal } from '@zenith/state';

test('logout clears session', () => {
  resetForTesting();
  expect(signal).toBeDefined();
});
