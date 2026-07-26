export {
  compileTemplate,
  type CompiledTemplate,
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
