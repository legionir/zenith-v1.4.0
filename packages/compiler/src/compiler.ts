/** Established compiler import facade; one canonical factory and classification sets. */
export { compileTemplate } from './engine';
export { COMPILABLE_DIRECTIVES, RUNTIME_DIRECTIVES } from './directives';
export type { CompiledTemplate, CompilerOptions, CompileOptions } from './types';

/**
 * #111 — موتور مشترک typecheck قالب (compiler و language-server).
 * @public
 */
export {
  analyzeTemplateTypes,
  type TemplateStateTypes,
  type TemplateTypeDiagnostic,
  type TemplateTypeIssueKind,
} from './template-typecheck';
