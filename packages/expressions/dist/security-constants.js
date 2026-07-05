// packages/expressions/src/security-constants.ts
//
// Shared security constants for the expression sub-system.
//
// FIX (v1.2.8): P1-1 — Previously the Validator (`validator.js`) and the
// Evaluator (`evaluator.js`) each maintained their own FORBIDDEN_PROPERTIES
// list, and the two had drifted out of sync:
//   - validator.js blocked:        constructor, __proto__, prototype
//   - evaluator.js blocked (RT):   constructor, __proto__, prototype,
//                                  __defineGetter__, __defineSetter__
//
// This file is the single source of truth. Both validator.js and
// evaluator.js import FORBIDDEN_PROPERTIES from here, so adding a new
// property to this list automatically updates both layers.
/**
 * Forbidden property names that must NEVER be accessed via a
 * MemberExpression (neither dot nor bracket notation) — neither at
 * compile-time (Validator) nor at runtime (Evaluator).
 *
 * Frozen to prevent accidental or malicious tampering at runtime.
 */
export const FORBIDDEN_PROPERTIES = Object.freeze([
    'constructor',
    '__proto__',
    'prototype',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
]);
