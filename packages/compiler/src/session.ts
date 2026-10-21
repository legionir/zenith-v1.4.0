import type { CompiledTemplate, CompilerOptions } from './types';
import type { DirectiveInfo } from './syntax-types';
/** One mutable compilation session, never a fabricated compiler instance. @internal */
export interface CompileSession {
  options: CompilerOptions;
  codeLines: string[];
  allExprs: string[];
  warnings: string[];
  runtimeDirectives: CompiledTemplate['runtimeDirectives'];
  elementCount: number;
  effectCount: number;
  varCounter: number;
}
/** @internal */
export interface DirectiveInput { session: CompileSession; varName: string; parentVar: string; allDirectives: DirectiveInfo[]; el: Element; }
