import { expect, it, vi } from 'vitest';
import { compile, evaluate, evaluateExpression } from '../src';

it('preserves native BigInt arithmetic and unary conversion errors', () => {
  const context = { $a: 2n, $b: 3n };
  expect(evaluate(compile('$a + $b'), context)).toBe(5n);
  expect(evaluateExpression('-$a', context)).toBe(-2n);
  expect(() => evaluateExpression('+$a', context)).toThrow(TypeError);
  expect(() => evaluateExpression('$a + 1', context)).toThrow(TypeError);
});
it('preserves native primitive coercion order without eager Number conversions', () => {
  const order: string[] = [];
  const $a = { valueOf() { order.push('a'); return 4; } };
  const $b = { valueOf() { order.push('b'); return '2'; } };
  expect(evaluateExpression('$a + $b', { $a, $b })).toBe('42');
  expect(order).toEqual(['a', 'b']);
  expect(evaluateExpression('$a == $b', { $a: 0, $b: '' })).toBe(true);
  expect(evaluateExpression('$a === $b', { $a: 0, $b: '' })).toBe(false);
  expect(() => evaluateExpression('$a + 1', { $a: Symbol('value') })).toThrow(TypeError);
});
it('keeps inherited getter contexts live and member-call receivers unchanged', () => {
  const owner = { value: 3, increment() { this.value++; return this.value; } };
  const getter = vi.fn(() => owner);
  const parent = Object.defineProperty({}, '$owner', { get: getter });
  const child: object = Object.create(parent);
  expect(evaluateExpression('$owner.increment()', child)).toBe(4);
  // Legacy evaluator reads the receiver and callee separately; no deduped getter.
  expect(getter).toHaveBeenCalledTimes(2);
  expect(owner.value).toBe(4);
});
it('retains logical, nullish, conditional and optional-call short circuits', () => {
  const $explode = vi.fn(() => { throw new Error('must not evaluate'); });
  const context = { $explode, $off: false, $on: true, $nothing: null, $value: 7 };
  expect(evaluateExpression('$off && $explode()', context)).toBe(false);
  expect(evaluateExpression('$on || $explode()', context)).toBe(true);
  expect(evaluateExpression('$value ?? $explode()', context)).toBe(7);
  expect(evaluateExpression('$on ? $value : $explode()', context)).toBe(7);
  expect(evaluateExpression('$nothing?.method()', context)).toBeUndefined();
  expect($explode).not.toHaveBeenCalled();
});
it('preserves native property-key conversion and primitive member boxing', () => {
  const $key = { toString: () => 'value' };
  expect(evaluateExpression('$object[$key]', { $object: { value: 9 }, $key })).toBe(9);
  expect(evaluateExpression('$text.length', { $text: 'abc' })).toBe(3);
  const symbol = Symbol('key');
  expect(evaluateExpression('$object[$key]', { $object: { [symbol]: 11 }, $key: symbol })).toBe(11);
});
