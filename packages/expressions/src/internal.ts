// packages/expressions/src/internal.ts
//
// Low-level lexer/parser surface (`@zenith/expressions/internal`, #56).
// Deliberately uses the external self-specifier like `@zenith/state/internal`:
// the root owns all implementation and nominal declarations in each format.
// Never import `./lexer`/`./token`/`./parser` here directly: independently
// bundling those would create a second token/parser graph. Keep legacy root
// names until removal is approved (2.0, DEC-026); new consumers must use this
// subpath.
export { lex, TokenType, type Token } from '@zenith/expressions';
export { Parser } from '@zenith/expressions';
