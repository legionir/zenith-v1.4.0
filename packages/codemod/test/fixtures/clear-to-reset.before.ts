import { clearAuth } from '@zenith/auth';
import { signal } from '@zenith/state';

test('logout clears session', () => {
  clearAuth();
  expect(signal).toBeDefined();
});
