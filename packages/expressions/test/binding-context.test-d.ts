import { expectTypeOf } from 'vitest';
import { compileExpression, createBindingContext, evaluateExpression } from '../src/index';

const context = createBindingContext({ count: { get: () => 1 } });
const result = compileExpression('$count + 1')(context);
expectTypeOf(result).toEqualTypeOf<unknown>();
expectTypeOf(evaluateExpression('$count', context)).toEqualTypeOf<unknown>();
// @ts-expect-error An arbitrary expression is not a statically proven string.
const unsafeString: string = result;
// @ts-expect-error Nor does the result expose arbitrary callable properties.
result.callArbitraryMethod();
void unsafeString;
