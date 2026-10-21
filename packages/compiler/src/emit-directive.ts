import type { DirectiveInfo } from './syntax-types';
import type { DirectiveInput } from './session';
import { emitValueDirective } from './emit-values';
import { emitModelDirective } from './emit-model';
import { emitForDirective } from './emit-for';
/** Stop on the first successful emitter; preserve failed-bind bookkeeping. @internal */
export function emitDirective(dir: DirectiveInfo, input: DirectiveInput): boolean {
  return emitValueDirective(dir, input) || emitModelDirective(dir, input) || emitForDirective(dir, input);
}
