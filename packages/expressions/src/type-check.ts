/**
 * Expression Type Checking Infrastructure
 *
 * Provides foundation for type-safe evaluation of template expressions at compile time.
 * This module can be extended later to integrate with TypeScript type checking.
 */

/** @public */
export type ExpressionType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'undefined'
  | 'object'
  | 'array'
  | 'function'
  | 'unknown';

/** @public */
export interface TypeCheckResult {
  type: ExpressionType;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** @public */
export interface TypeContext {
  /** Known variable types in scope */
  variables: Record<string, ExpressionType>;
}

/**
 * Infer a simple type from a JavaScript value at runtime.
 * @public
 */
export function inferType(value: unknown): ExpressionType {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  const base = typeof value;
  if (
    base === 'string' ||
    base === 'number' ||
    base === 'boolean' ||
    base === 'function' ||
    base === 'object'
  ) {
    return base;
  }
  return 'unknown';
}

/**
 * Check if a value is assignable to an expected type.
 * @public
 */
export function isAssignableTo(value: unknown, expected: ExpressionType): boolean {
  const actual = inferType(value);
  if (actual === expected) return true;
  // Loose compatibility rules
  if (expected === 'object' && actual === 'array') return true;
  if (expected === 'unknown') return true;
  if (actual === 'null' || actual === 'undefined') return true;
  return false;
}

/**
 * Validate an expression value against an expected type.
 * @public
 */
export function validateType(
  value: unknown,
  expected: ExpressionType,
  expression: string,
): TypeCheckResult {
  const actual = inferType(value);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isAssignableTo(value, expected)) {
    errors.push(
      `Expression "${expression}" evaluates to type "${actual}", expected "${expected}".`,
    );
  }

  if (actual === 'unknown') {
    warnings.push(`Expression "${expression}" has unknown type — cannot verify type safety.`);
  }

  return {
    type: actual,
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Create a type context for template scope.
 * @public
 */
export function createTypeContext(variables: Record<string, ExpressionType> = {}): TypeContext {
  return { variables: { ...variables } };
}

/**
 * Assert that a value is of a specific type (for internal runtime checks).
 * @public
 */
export function assertType<T>(value: unknown, guard: (v: unknown) => v is T): value is T {
  return guard(value);
}

/**
 * Common type guards.
 * @public
 */
export const TypeGuards = {
  isString: (v: unknown): v is string => typeof v === 'string',
  isNumber: (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v),
  isBoolean: (v: unknown): v is boolean => typeof v === 'boolean',
  isObject: (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v),
  isArray: (v: unknown): v is unknown[] => Array.isArray(v),
  isFunction: (v: unknown): v is (...args: never[]) => unknown => typeof v === 'function',
};
