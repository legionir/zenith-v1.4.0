import type { Realtime } from './types';

import { testReceiverFor } from './test-receiver';

/** Test-only delivery; never changes connection status or simulates a network send. @public */
export function injectRealtimeMessage<T>(client: Realtime<T>, data: T, topic = '*'): void {
  testReceiverFor(client)?.(data, topic);
}
