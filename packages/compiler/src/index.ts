export {
  compileTemplate,
  COMPILABLE_DIRECTIVES,
  RUNTIME_DIRECTIVES,
  type CompiledTemplate,
  type CompilerOptions,
  type CompileOptions,
} from './compiler';

/**
 * #111 — موتور مشترک typecheck قالب (type-safe template opt-in).
 * @public
 */
export {
  analyzeTemplateTypes,
  type TemplateStateTypes,
  type TemplateTypeDiagnostic,
  type TemplateTypeIssueKind,
} from './template-typecheck';

/**
 * FEATURE (v1.4.0): Runtime ↔ Compiler Parity Testing Framework.
 */
export {
  runParityTest,
  runAllParityTests,
  generateParityReport,
  STANDARD_TEST_SUITES,
  CORE_DIRECTIVES,
  type ParityTestContext,
  type ParityResult,
  type ParityTestSuite,
  type ParityRunner,
  type ParityRunnerOptions,
  type ParityReport,
} from './parity';

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/compiler` (`CompilerOptions`).
 * @default { minify: false, sourceMap: false, mode: 'spa' }
 * @since 1.4.0
 * @public
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  minify: false,
  sourceMap: false,
  mode: 'spa' as const,
});
