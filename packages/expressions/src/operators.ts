/**
 * Native JS operators intentionally accept arbitrary runtime operands. These
 * three internal `any` annotations preserve ToPrimitive, BigInt, Symbol errors,
 * loose equality and coercion order; Number()/String() would change semantics.
 * No `any` escapes through the evaluator's public unknown result.
 * @internal
 */
export function binaryOperation(operator: string, operands: { left: unknown; right: unknown }): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- native operator boundary; see above
  const left: any = operands.left;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- native operator boundary; see above
  const right: any = operands.right;
  switch (operator) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return left / right;
    case '%': return left % right;
    case '==': return left == right;
    case '===': return left === right;
    case '!=': return left != right;
    case '!==': return left !== right;
    case '<': return left < right;
    case '>': return left > right;
    case '<=': return left <= right;
    case '>=': return left >= right;
    default: throw new Error(`Unknown binary operator: '${operator}'`);
  }
}
/** Same native-coercion boundary as binaryOperation. @internal */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- unary + must still reject BigInt
export function unaryOperation(operator: string, value: any): unknown {
  if (operator === '!') return !value;
  if (operator === '-') return -value;
  if (operator === '+') return +value;
  throw new Error(`Unknown unary operator: '${operator}'`);
}
