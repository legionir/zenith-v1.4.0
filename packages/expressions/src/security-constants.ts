// packages/expressions/src/security-constants.ts
//
// Shared security constants for the expression sub-system.
//
// FIX (v1.2.8): P1-1 — Previously the Validator (`validator.ts`) and the
// Evaluator (`evaluator.ts`) each maintained their own FORBIDDEN_PROPERTIES
// list, and the two had drifted out of sync:
//   - validator.ts blocked:        constructor, __proto__, prototype
//   - evaluator.ts blocked (RT):   constructor, __proto__, prototype,
//                                  __defineGetter__, __defineSetter__
//
// This meant expressions like `obj['__lookupGetter__']` and
// `obj['__lookupSetter__']` would pass the static validator and only be
// caught at runtime — and only because evaluator's RT list happened to
// include them. Worse, any future addition to one list could silently miss
// the other, opening a hole.
//
// This file is the single source of truth. Both validator.ts and
// evaluator.ts import FORBIDDEN_PROPERTIES from here, so adding a new
// property to this list automatically updates both layers.

/**
 * Forbidden property names that must NEVER be accessed via a
 * MemberExpression (neither dot nor bracket notation) — neither at
 * compile-time (Validator) nor at runtime (Evaluator).
 *
 * These are the well-known "prototype pollution" and "accessor escape"
 * vectors on Object.prototype:
 *   - constructor       → grants access to Function and Object constructors
 *   - __proto__         → mutates [[Prototype]] link (prototype pollution)
 *   - prototype         → reaches function/class prototype objects
 *   - __defineGetter__  → installs arbitrary getters (sandbox escape)
 *   - __defineSetter__  → installs arbitrary setters (sandbox escape)
 *   - __lookupGetter__  → leaks getter function references
 *   - __lookupSetter__  → leaks setter function references
 *
 * Frozen to prevent accidental or malicious tampering at runtime.
 */
export const FORBIDDEN_PROPERTIES: readonly string[] = Object.freeze([
  'constructor',
  '__proto__',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
  'caller',
  'callee',
  'arguments',
  'arity',
  'name',
  'toString',
  'valueOf',
  'toLocaleString',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'getOwnPropertyDescriptor',
  'getOwnPropertyNames',
  'getOwnPropertySymbols',
  'keys',
  'values',
  'entries',
  'assign',
  'create',
  'defineProperty',
  'defineProperties',
  'freeze',
  'seal',
  'preventExtensions',
  'isFrozen',
  'isSealed',
  'isExtensible',
  'setPrototypeOf',
  'Reflect',
  'Proxy',
  'Object',
  'Function',
  'eval',
  'setTimeout',
  'setInterval',
  'Function.prototype',
  'global',
  'globalThis',
  'window',
  'document',
  'location',
  'history',
]);

/**
 * Forbidden identifiers/globals that must NEVER be used as standalone
 * identifiers in expressions.
 */
export const FORBIDDEN_IDENTIFIERS: readonly string[] = Object.freeze([
  'eval',
  'Function',
  'Proxy',
  'Reflect',
  'window',
  'document',
  'globalThis',
  'global',
  'process',
  'require',
  'module',
  'exports',
]);

/**
 * Check if an identifier name is forbidden.
 */
export function isForbiddenIdentifier(name: string): boolean {
  return FORBIDDEN_IDENTIFIERS.includes(name) || FORBIDDEN_PROPERTIES.includes(name);
}

/**
 * Sanitize expression body — block arrow function exploits and
 * direct constructor calls.
 */
export function sanitizeExpression(expr: string): string {
  let clean = expr.trim();
  // Block arrow functions with direct execution: () => {(...)}
  clean = clean.replace(/\(\s*\)\s*=>\s*\{?\s*\(/g, '');
  // Block direct constructor calls
  clean = clean.replace(/constructor\s*[.(]/g, '');
  return clean;
}
