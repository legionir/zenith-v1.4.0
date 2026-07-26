/**
 * Expression Type Checking Infrastructure
 *
 * Provides foundation for type-safe evaluation of template expressions at compile time.
 * This module can be extended later to integrate with TypeScript type checking.
 */

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

export interface TypeCheckResult {
  type: ExpressionType;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TypeContext {
  /** Known variable types in scope */
  variables: Record<string, ExpressionType>;
}

/**
 * Infer a simple type from a JavaScript value at runtime.
 */
export function inferType(value: any): ExpressionType {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  const base = typeof value;
  if (base === 'string' || base === 'number' || base === 'boolean' || base === 'function' || base === 'object') {
    return base;
  }
  return 'unknown';
}

/**
 * Check if a value is assignable to an expected type.
 */
export function isAssignableTo(value: any, expected: ExpressionType): boolean {
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
 */
export function validateType(
  value: any,
  expected: ExpressionType,
  expression: string
): TypeCheckResult {
  const actual = inferType(value);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isAssignableTo(value, expected)) {
    errors.push(
      `Expression "${expression}" evaluates to type "${actual}", expected "${expected}".`
    );
  }

  if (actual === 'unknown') {
    warnings.push(`Expression "${expression}" has unknown type — cannot verify type safety.`);
  }

  return {
    type: actual,
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Create a type context for template scope.
 */
export function createTypeContext(variables: Record<string, ExpressionType> = {}): TypeContext {
  return { variables: { ...variables } };
}

/**
 * Assert that a value is of a specific type (for internal runtime checks).
 */
export function assertType<T>(value: any, guard: (v: any) => v is T): value is T {
  return guard(value);
}

/**
 * Common type guards.
 */
export const TypeGuards = {
  isString: (v: any): v is string => typeof v === 'string',
  isNumber: (v: any): v is number => typeof v === 'number' && !Number.isNaN(v),
  isBoolean: (v: any): v is boolean => typeof v === 'boolean',
  isObject: (v: any): v is Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v),
  isArray: (v: any): v is any[] => Array.isArray(v),
  isFunction: (v: any): v is (...args: any[]) => any => typeof v === 'function'
};
