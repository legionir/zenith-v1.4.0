import { expect, it } from 'vitest';
import { writeInspectedSignal } from '../src/signal-mutation';
it('calls the actual setter with the real receiver and payload identity', () => {
  const value = { nested: ['payload'] }, target = { value: null as unknown, set(next: unknown) { this.value = next; } };
  writeInspectedSignal(target, value); expect(target.value).toBe(value);
});
it('does not manufacture write capability for read-only or malformed inspection views', () => {
  expect(() => writeInspectedSignal({ get: () => 1 }, 2)).toThrow('setter');
  expect(() => writeInspectedSignal({ set: 1 }, 2)).toThrow('setter');
});
it('preserves readonly/disposed setter failures for restore/replay to handle', () => {
  const error = new Error('readonly'), target = { set() { throw error; } };
  expect(() => writeInspectedSignal(target, 2)).toThrow(error);
});
