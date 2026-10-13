export {
  compileTemplate,
  type CompiledTemplate,
  type CompilerOptions,
  type CompileOptions,
} from './compiler';

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
} from './parity';

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/compiler` (`CompilerOptions`).
 * @default { minify: false, sourceMap: false, mode: 'spa' }
 * @since 1.4.0
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  minify: false,
  sourceMap: false,
  mode: 'spa' as const,
});

