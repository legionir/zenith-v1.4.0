import { describe, expect, it, vi } from 'vitest';
import { createBindingContext, evaluateExpression } from '../src/index';
import { effect, signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';

describe('shared lazy binding context (#120, code-first tests not executed)', () => {
  it('unwraps signals with tracked reads for both named and dollar aliases', () => {
    const count = signal(1); const context = createBindingContext({ count }); const values: unknown[] = [];
    const release = effect(() => { values.push(evaluateExpression('count + $count', context)); });
    expect(values).toEqual([2]); count.set(4); flushSync(); expect(values).toEqual([2, 8]);
    release(); count.set(5); flushSync(); expect(values).toEqual([2, 8]); count.dispose();
  });
  it('keeps local precedence, explicit dollar names and parent lexical getters', () => {
    const parent = { item: 1 }; const locals = Object.create(parent) as Record<string, unknown>;
    locals.$item = 4;
    const context = createBindingContext({ item: 0 }, locals);
    expect(evaluateExpression('item + $item', context)).toBe(5);
    parent.item = 3; expect(evaluateExpression('item + $item', context)).toBe(7);
  });
  it('does not evaluate getters during construction or name enumeration', () => {
    const getter = vi.fn(() => 42); const state = {};
    Object.defineProperty(state, 'answer', { get: getter, enumerable: true });
    const context = createBindingContext(state);
    expect(Object.keys(context)).toEqual(['answer']); expect(getter).not.toHaveBeenCalled();
    expect(evaluateExpression('$answer', context)).toBe(42); expect(getter).toHaveBeenCalledOnce();
  });
  it('does not copy a parent reactive view into a stale snapshot', () => {
    const value = signal('first'); const parent = createBindingContext({ value });
    const child = createBindingContext(parent, { local: 2 });
    expect(evaluateExpression('value', child)).toBe('first'); value.set('second');
    expect(evaluateExpression('$value', child)).toBe('second'); value.dispose();
  });
  it('rejects prototype builtins and mutation instead of changing a backing state', () => {
    const state = { value: 1 }; const context = createBindingContext(state);
    expect(() => evaluateExpression('toString', context)).toThrow();
    expect(() => { context.value = 2; }).toThrow(); expect(state.value).toBe(1);
    expect(() => evaluateExpression('$value.constructor', context)).toThrow();
  });
});
