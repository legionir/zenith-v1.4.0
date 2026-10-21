import { expect, it } from 'vitest';
import * as root from '../src/index';
import * as internal from '../src/internal';
import type { Token } from '../src/internal';

it('#56 `@zenith/expressions/internal` exposes the same lexer/parser symbols as the root (one token graph)', () => {
  const names = ['lex', 'TokenType', 'Parser'] as const;
  for (const name of names) {
    expect((internal as Record<string, unknown>)[name], name).toBe(
      (root as Record<string, unknown>)[name],
    );
  }
  expect(Object.keys(internal).sort()).toEqual([...names].sort());
});

// Type surface rides the same self-specifier facade (erased at runtime).
const _token: Token | null = null;
void _token;
