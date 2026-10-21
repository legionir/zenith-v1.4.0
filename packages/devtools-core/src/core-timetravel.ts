// packages/devtools-core/src/core-timetravel.ts
//
// سفر در زمان (snapshot/restore/replay) — استخراج مکانیکی از index.ts بدون
// تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { createReservedError } from '@zenith/errors';
import { untrack } from '@zenith/state';
import { resolveInspectedWriter } from './signal-mutation';
import { DEVTOOLS_HOOK_VERSION } from './core-options';
import { assertHookVersion, hook } from './core-registry';
import {
  cleanupDeadSignals,
  formatCapturedValue,
  idToInfo,
  isTrackingEnabled,
  registryGeneration,
  restoringOperations,
  timeline,
} from './core-state';
import type { Snapshot, SnapshotSignalEntry } from './core-types';


// ── Time-Travel: snapshot / restore / replay ──

/** Capture actual readable values without attaching reactive dependencies. @public */
export function snapshot(): Snapshot {
  const generation = registryGeneration;
  const entries: Array<[string, SnapshotSignalEntry]> = [];
  if (isTrackingEnabled()) untrack(() => {
    cleanupDeadSignals();
    for (const [id, info] of Array.from(idToInfo)) {
      if (generation !== registryGeneration || !isTrackingEnabled()) break;
      const sig = info.signalRef.deref();
      if (!sig) continue;
      const value = structuredClone(typeof sig.peek === 'function' ? sig.peek() : sig.get());
      if (generation !== registryGeneration || idToInfo.get(id) !== info || !isTrackingEnabled()) continue;
      entries.push([id, { name: info.name, value }]);
    }
  });
  const current = generation === registryGeneration && isTrackingEnabled();
  return {
    version: DEVTOOLS_HOOK_VERSION, timestamp: Date.now(),
    signals: current ? Object.fromEntries(entries) : {}, timelineLength: current ? timeline.length : 0,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// A concrete decoder constructs a Snapshot. It neither casts unknown into an
// arbitrary T nor forwards an unvalidated object as a typed hook event.
function decodeSnapshot(input: unknown): Snapshot {
  const invalid = (reason: string): never => { throw createReservedError('ZEN-2402', { details: { reason } }); };
  if (!isPlainObject(input)) return invalid('snapshot must be an object');
  const timestamp = input.timestamp, version = input.version, signals = input.signals;
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return invalid('invalid timestamp');
  if (typeof version !== 'string') return invalid('missing version');
  assertHookVersion(version);
  if (!isPlainObject(signals)) return invalid('signals must be an object');
  const rawLength = input.timelineLength;
  // Historical restore accepted snapshots without timeline metadata. Normalize
  // that legacy omission explicitly, rather than pretending it was validated.
  const timelineLength = rawLength === undefined ? 0 : rawLength;
  if (typeof timelineLength !== 'number' || !Number.isSafeInteger(timelineLength) || timelineLength < 0) return invalid('invalid timeline length');
  const entries: Array<[string, SnapshotSignalEntry]> = [];
  for (const [id, entry] of Object.entries(signals)) {
    if (!isPlainObject(entry) || !('value' in entry)) return invalid('invalid signal entry');
    const name = entry.name, value = entry.value;
    if (name !== undefined && typeof name !== 'string') return invalid('invalid signal name');
    entries.push([id, name === undefined ? { value } : { name, value }]);
  }
  return { timestamp, version, timelineLength, signals: Object.fromEntries(entries) };
}

/** Validate and restore a concrete Snapshot; readonly setters remain unsupported. @public */
export function restore(input: unknown): void {
  if (!isTrackingEnabled()) return;
  const generation = registryGeneration;
  const decoded = untrack(() => decodeSnapshot(input));
  if (generation !== registryGeneration || !isTrackingEnabled()) return;
  const operation = {}; restoringOperations.add(operation);
  try {
    for (const [id, entry] of Object.entries(decoded.signals)) {
      if (generation !== registryGeneration || !isTrackingEnabled()) break;
      const info = idToInfo.get(id), sig = untrack(() => info?.signalRef.deref());
      if (!sig || !info) continue;
      try {
        const value = untrack(() => structuredClone(entry.value));
        const write = untrack(() => resolveInspectedWriter(sig));
        if (generation !== registryGeneration || idToInfo.get(id) !== info || !isTrackingEnabled()) break;
        untrack(() => write(value));
        const captured = untrack(() => formatCapturedValue(value));
        if (generation === registryGeneration && idToInfo.get(id) === info) info.value = captured;
      } catch { /* reject unsupported clone/setter without fabricating writability */ }
    }
  } finally { restoringOperations.delete(operation); }
  if (generation === registryGeneration && isTrackingEnabled()) hook.emit('snapshot:restore', decoded);
}

/** Replay stable event data; reset invalidates sleeping work without reviving it. @public */
export async function replay(from: number, to: number, opts?: { speed?: number }): Promise<void> {
  if (!isTrackingEnabled()) return;
  const generation = registryGeneration;
  const speed = untrack(() => opts?.speed ?? 1);
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed <= 0 || !Number.isFinite(from) || !Number.isFinite(to)) {
    throw createReservedError('ZEN-1004', { details: { path: 'replay', expected: 'finite indexes and speed > 0' } });
  }
  if (generation !== registryGeneration || !isTrackingEnabled()) return;
  const steps = timeline.slice(); if (steps.length === 0) return;
  const clamp = (index: number) => Math.max(0, Math.min(steps.length - 1, Math.trunc(index)));
  const start = clamp(from), end = clamp(to), step = start <= end ? 1 : -1;
  const operation = {}; restoringOperations.add(operation);
  try {
    for (let index = start; step > 0 ? index <= end : index >= end; index += step) {
      if (generation !== registryGeneration || !isTrackingEnabled()) break;
      const entry = steps[index]; if (!entry) continue;
      const info = idToInfo.get(entry.signalId), sig = untrack(() => info?.signalRef.deref());
      if (sig && info) try {
        const target = untrack(() => step > 0 ? entry.newValue : entry.oldValue);
        const write = untrack(() => resolveInspectedWriter(sig));
        if (generation !== registryGeneration || idToInfo.get(entry.signalId) !== info || !isTrackingEnabled()) break;
        untrack(() => write(target));
        const captured = untrack(() => formatCapturedValue(target));
        if (generation === registryGeneration && idToInfo.get(entry.signalId) === info) info.value = captured;
      } catch { /* readonly setter */ }
      if (index !== end && speed < 100) {
        const delayMs = Math.min(20, Math.max(0, Math.round(5 / speed)));
        if (delayMs > 0) await new Promise<void>(resolve => setTimeout(resolve, delayMs));
      }
    }
  } finally { restoringOperations.delete(operation); }
}