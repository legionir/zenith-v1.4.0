import { logger } from '@zenith/logger';
import type { ResourceScope } from './scope';

/** Private mutation ownership helper. @internal */
export function captureSnapshot<T>(scope: ResourceScope<T>): number {
    const version = ++scope._optimisticVersion;
    // Deep-clone the current data so the snapshot is not mutated in-place
    // by subsequent optimistic patches.
    scope._optimisticSnapshots.set(version, structuredClone(scope._signal.get().data));
    return version;
  }

/** Private mutation ownership helper. @internal */
export function finalizeSnapshot<T>(scope: ResourceScope<T>, version: number): void {
    scope._optimisticSnapshots.delete(version);
  }

/** Private mutation ownership helper. @internal */
export function rollbackSnapshot<T>(scope: ResourceScope<T>, version: number): void {
    // Only rollback if this version's snapshot still exists, meaning no
    // newer (higher-version) update has succeeded and been deleted yet.
    const snapshot = scope._optimisticSnapshots.get(version);
    if (snapshot !== undefined) {
      // Clear all snapshots >= this version — they're invalid now.
      for (const [v] of scope._optimisticSnapshots) {
        if (v >= version) scope._optimisticSnapshots.delete(v);
      }
      scope.setData(() => snapshot);
    }
  }

/** Private mutation ownership helper. @internal */
export async function processQueue<T>(scope: ResourceScope<T>): Promise<void> {
    if (scope._processing || scope._destroyed) return;
    scope._processing = true; const generation = scope._lifecycleGeneration;
    const current = () => !scope._destroyed && generation === scope._lifecycleGeneration;
    try {
      while (current() && scope._mutationQueue.length) {
        const item = scope._mutationQueue.shift()!;
        let failed = false;
        try { failed = (await item.op()).success === false; } catch { failed = true; }
        if (!current()) break;
        if (failed) { try { item.rollback?.(); } catch { /* A rollback failure cannot strand the queue. */ } logger.error('[Zenith Resource] Mutation failed.'); }
      }
    } finally { if (generation === scope._lifecycleGeneration) scope._processing = false; }
  }
