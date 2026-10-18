import { asAuthRecord } from './response';
import type { AuthEvent, AuthEventListener } from './types';
interface SyncOptions { channelName: string; scope: string; receive(type: 'logout' | 'refresh'): void; isReceiving(): boolean; on(event: AuthEvent, listener: AuthEventListener): () => void; onStop(): void; }
/** Transport owns only listeners; canonical session transitions stay in Auth. @internal */
export function openAuthSynchronization(options: SyncOptions): () => void {
  const cleanups: Array<() => void> = [];
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel(options.channelName);
        const onMessage = (event: MessageEvent<unknown>) => {
          const data = asAuthRecord(event.data);
          if (data?.version === 1 && data.scope === options.scope && (data.type === 'logout' || data.type === 'refresh')) options.receive(data.type);
        };
        channel.addEventListener('message', onMessage);
        const publish = (type: 'logout' | 'refresh') => {
          if (!options.isReceiving()) {
            try { channel.postMessage({ version: 1, scope: options.scope, type }); } catch { /* Closed/unavailable channel. */ }
          }
        };
        cleanups.push(options.on('logout', () => publish('logout')), options.on('token-refresh', () => publish('refresh')),
          () => { channel.removeEventListener('message', onMessage); channel.close(); });
      }
    } catch { /* Fall back to storage events without making auth initialization fail. */ }
    if (typeof window !== 'undefined') {
      const onStorage = (event: StorageEvent) => {
        if (event.key === options.scope) options.receive(event.newValue === null ? 'logout' : 'refresh');
      };
      window.addEventListener('storage', onStorage);
      cleanups.push(() => window.removeEventListener('storage', onStorage));
    }
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      options.onStop();
      for (const cleanup of cleanups) { try { cleanup(); } catch { /* Complete all teardown steps. */ } }
    };
  return stop;
}
