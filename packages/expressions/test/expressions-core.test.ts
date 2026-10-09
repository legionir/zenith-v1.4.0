// #27 core tests for @zenith/expressions — parser, validator, evaluator, cache.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateExpression,
  compileExpression,
  compile,
  evaluate,
  validate,
  lex,
  Parser,
  clearCache,
  getCacheSize,
  getCacheStats,
  configureCache,
} from '@zenith/expressions';

beforeEach(() => clearCache());

describe('evaluator (safe subset)', () => {
  it('evaluates arithmetic and member access on context vars', () => {
    expect(evaluateExpression('$a + $b', { $a: 2, $b: 3 })).toBe(5);
    expect(evaluateExpression('$user.age * 2', { $user: { age: 21 } })).toBe(42);
  });

  it('evaluates comparisons and logical ops', () => {
    expect(evaluateExpression('$user.age > 18', { $user: { age: 25 } })).toBe(true);
    expect(evaluateExpression('$x && $y', { $x: 1, $y: 2 })).toBe(2);
    expect(evaluateExpression('$x || $y', { $x: 0, $y: 7 })).toBe(7);
  });

  it('evaluates string and number literals', () => {
    expect(evaluateExpression('"hello"', {})).toBe('hello');
    expect(evaluateExpression('42', {})).toBe(42);
    expect(evaluateExpression('true', {})).toBe(true);
  });

  it('compileExpression evaluates the cached AST repeatedly without recompiling', () => {
    const fn = compileExpression('$n * $n');
    expect(fn({ $n: 3 })).toBe(9);
    expect(fn({ $n: 4 })).toBe(16);
  });
});

describe('security: validator rejects dangerous expressions', () => {
  const forbidden = [
    'eval("1+1")',
    'Function("return 1")',
    'window.location',
    'document.body',
    'globalThis.x',
    '$obj.constructor',
    '$obj.__proto__',
    '$obj["prototype"]',
  ];
  for (const expr of forbidden) {
    it(`rejects: ${expr}`, () => {
      expect(() => evaluateExpression(expr, { $obj: {} })).toThrow();
    });
  }

  it('blocks dynamic (runtime) prototype access via bracket key', () => {
    // validator cannot see the key statically; the evaluator RT guard must.
    expect(() =>
      evaluateExpression('$obj[$key]', { $obj: { a: 1 }, $key: 'constructor' }),
    ).toThrow();
  });

  it('validate() throws on a hand-built dangerous AST node', () => {
    const ast = {
      type: 'MemberExpression',
      object: { type: 'Identifier', name: 'foo' },
      property: { type: 'Identifier', name: '__proto__' },
      computed: false,
    } as any;
    expect(() => validate(ast)).toThrow();
  });
});

describe('parser / lexer', () => {
  it('lexes tokens', () => {
    const tokens = lex('1 + 2');
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('throws on malformed input (bad operator syntax)', () => {
    expect(() => compile('1 +* 2')).toThrow();
  });

  it('Parser produces an AST for a valid expression', () => {
    const ast = new Parser('$a + 1').parse();
    expect(ast.type).toBeTruthy();
  });

  // #10 regression guard: incomplete input ending at EOF must throw a clear
  // error rather than crash with "cannot read current() of null".
  it('throws (not null-deref) on truncated expression', () => {
    expect(() => compile('$a +')).toThrow();
    expect(() => compile('(1 +')).toThrow();
  });
});

describe('cache', () => {
  it('caches compiled AST and reports hits/misses', () => {
    compile('$x + 1');
    const sizeAfterFirst = getCacheSize();
    compile('$x + 1'); // second time → hit
    expect(getCacheSize()).toBe(sizeAfterFirst);
    const stats = getCacheStats();
    expect(stats.hits).toBeGreaterThanOrEqual(1);
  });

  it('respects configured max size (LRU eviction)', () => {
    configureCache({ maxSize: 2 });
    clearCache();
    compile('$a');
    compile('$b');
    compile('$c'); // should evict oldest
    expect(getCacheSize()).toBeLessThanOrEqual(2);
    configureCache({ maxSize: 500 });
    clearCache();
  });

  it('evaluate() uses a precompiled AST', () => {
    const ast = compile('$v * 2');
    expect(evaluate(ast, { $v: 5 })).toBe(10);
  });
});
