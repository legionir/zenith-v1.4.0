// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { createAnalytics } from '../src';
it('retains and sends no user events on the server even with consent', async () => {
  const send = vi.fn(), id = vi.fn(() => 'must-not-allocate');
  const analytics = createAnalytics({ consent: { default: true }, respectDNT: false, providers: [{ name: 'server', send }], sessionIdFactory: id });
  analytics.identify('private-user', { token: 'private-token' }); analytics.track('event'); await analytics.flush(); analytics.dispose();
  expect(send).not.toHaveBeenCalled(); expect(id).not.toHaveBeenCalled();
});
