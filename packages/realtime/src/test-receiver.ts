// Weak ownership; no global strong reference keeps disposed clients alive.
const receivers = new WeakMap<object, (data: unknown, topic: string) => void>();
export function registerTestReceiver(client: object, receive: (data: unknown, topic: string) => void): () => void {
  receivers.set(client, receive);
  return () => { receivers.delete(client); };
}


export function testReceiverFor(client: object) { return receivers.get(client); }
