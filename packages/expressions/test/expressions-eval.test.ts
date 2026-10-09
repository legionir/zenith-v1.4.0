// #27 broader coverage tests for @zenith/expressions: evaluator branches,
// lexer tokens, type-check module.
import { describe, it, expect } from 'vitest';
import {
  evaluateExpression,
  inferType,
  isAssignableTo,
  validateType,
  createTypeContext,
  assertType,
  TypeGuards,
} from '@zenith/expressions';
import { lex, TokenType } from '@zenith/expressions';

describe('evaluator: expression forms', () => {
  it('ternary / conditional', () => {
    expect(evaluateExpression('$a > 1 ? "big" : "small"', { $a: 5 })).toBe('big');
    expect(evaluateExpression('$a > 1 ? "big" : "small"', { $a: 0 })).toBe('small');
  });

  it('unary operators', () => {
    expect(evaluateExpression('!$flag', { $flag: false })).toBe(true);
    expect(evaluateExpression('-$n', { $n: 3 })).toBe(-3);
    expect(evaluateExpression('+$n', { $n: '3' })).toBe(3);
    expect(() => evaluateExpression('typeof $n', { $n: 1 })).toThrow();
  });

  it('nullish coalescing', () => {
    expect(evaluateExpression('$a ?? "dflt"', { $a: null })).toBe('dflt');
    expect(evaluateExpression('$a ?? "dflt"', { $a: 0 })).toBe(0);
  });

  it('array and object literals', () => {
    expect(evaluateExpression('[1, 2, $x]', { $x: 3 })).toEqual([1, 2, 3]);
    expect(evaluateExpression('({ a: 1, b: $x })', { $x: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('template literal interpolation', () => {
    expect(evaluateExpression('`hi ${$name}`', { $name: 'Ali' })).toBe('hi Ali');
  });

  it('function calls resolve from context and bind this', () => {
    const ctx = {
      $add: (a: number, b: number) => a + b,
      $obj: {
        v: 7,
        get() {
          return this.v;
        },
      },
    };
    expect(evaluateExpression('$add(2, 3)', ctx)).toBe(5);
    expect(evaluateExpression('$obj.get()', ctx)).toBe(7);
  });

  it('calling a non-function throws', () => {
    expect(() => evaluateExpression('$x()', { $x: 1 })).toThrow();
  });

  it('member access on null returns undefined (template-friendly)', () => {
    expect(evaluateExpression('$a.b', { $a: null })).toBeUndefined();
  });

  it('arrow functions can be created and applied', () => {
    // arrow evaluates to a callable; call it through a wrapper in context
    const ctx = { $apply: (f: any, x: number) => f(x) };
    expect(evaluateExpression('$apply((n) => n * 2, 21)', ctx)).toBe(42);
  });

  it('string concatenation with +', () => {
    expect(evaluateExpression('$a + "!"', { $a: 'hi' })).toBe('hi!');
  });

  it('deep member chains', () => {
    expect(evaluateExpression('$u.profile.title', { $u: { profile: { title: 'x' } } })).toBe('x');
  });

  it('undefined identifier throws', () => {
    expect(() => evaluateExpression('$missing + 1', {})).toThrow();
  });
});

describe('lexer token variety', () => {
  it('lexer produces Identifier/Number/String/Punctuator/EOF tokens', () => {
    const toks = lex('$a === 1 && "x" >= [2]');
    const types = toks.map((t) => t.type);
    expect(types).toContain(TokenType.Identifier);
    expect(types).toContain(TokenType.Number);
    expect(types).toContain(TokenType.String);
    expect(types).toContain(TokenType.Punctuator);
    expect(types[types.length - 1]).toBe(TokenType.EOF);
  });

  it('empty input yields an EOF-only stream', () => {
    const toks = lex('');
    expect(toks[toks.length - 1]!.type).toBe(TokenType.EOF);
  });
});

describe('type-check module', () => {
  it('inferType covers all primitives', () => {
    expect(inferType(null)).toBe('null');
    expect(inferType(undefined)).toBe('undefined');
    expect(inferType([])).toBe('array');
    expect(inferType('s')).toBe('string');
    expect(inferType(1)).toBe('number');
    expect(inferType(true)).toBe('boolean');
    expect(inferType({})).toBe('object');
    expect(inferType(() => 0)).toBe('function');
    expect(inferType(Symbol('x'))).toBe('unknown');
  });

  it('isAssignableTo loose rules', () => {
    expect(isAssignableTo([], 'object')).toBe(true);
    expect(isAssignableTo(1, 'unknown')).toBe(true);
    expect(isAssignableTo(null, 'string')).toBe(true);
    expect(isAssignableTo(1, 'string')).toBe(false);
  });

  it('validateType reports errors/warnings', () => {
    const ok = validateType(1, 'number', '$x');
    expect(ok.valid).toBe(true);
    const bad = validateType(1, 'string', '$x');
    expect(bad.valid).toBe(false);
    expect(bad.errors.length).toBe(1);
    const unk = validateType(Symbol('x'), 'unknown', '$x');
    expect(unk.warnings.join('')).toMatch(/unknown type/);
  });

  it('createTypeContext copies variables (immutable source)', () => {
    const src = { $x: 'number' as const };
    const ctx = createTypeContext(src);
    (ctx.variables as any).$y = 'string';
    expect(Object.keys(src)).toEqual(['$x']);
    expect(ctx.variables.$y).toBe('string');
  });

  it('assertType + TypeGuards', () => {
    expect(assertType(1, TypeGuards.isNumber)).toBe(true);
    expect(TypeGuards.isNumber(NaN)).toBe(false);
    expect(TypeGuards.isObject({})).toBe(true);
    expect(TypeGuards.isObject([])).toBe(false);
    expect(TypeGuards.isFunction(() => {})).toBe(true);
    expect(TypeGuards.isString('a')).toBe(true);
    expect(TypeGuards.isBoolean(true)).toBe(true);
    expect(TypeGuards.isArray([1])).toBe(true);
  });
});
