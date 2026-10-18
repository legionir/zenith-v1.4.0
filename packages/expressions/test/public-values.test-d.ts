import { expectTypeOf } from 'vitest';
import { assertType, compile, evaluate, inferType, TypeGuards, type ExpressionType } from '../src';
const result = evaluate(compile('$value'), { $value: 1 });
expectTypeOf(result).toEqualTypeOf<unknown>();
expectTypeOf(inferType(result)).toEqualTypeOf<ExpressionType>();
if (assertType(result, TypeGuards.isString)) expectTypeOf(result).toEqualTypeOf<string>();
if (TypeGuards.isObject(result)) expectTypeOf(result.field).toEqualTypeOf<unknown>();
if (TypeGuards.isArray(result)) expectTypeOf(result[0]).toEqualTypeOf<unknown>();
// @ts-expect-error Dynamic evaluator results are not unchecked strings.
const text: string = result;
// @ts-expect-error A property's runtime shape is not proven by isObject.
if (TypeGuards.isObject(result)) result.field.unsafeMethod();
void text;
