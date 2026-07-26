/**
 * Runtime ↔ Compiler Parity Testing Framework
 *
 * Ensures that every directive behaves identically in both runtime walker
 * and ahead-of-time compiled modes.
 */

export interface ParityTestContext {
  state: Record<string, any>;
  html: string;
}

export interface ParityResult {
  directive: string;
  runtimeOutput: string;
  compilerOutput: string;
  match: boolean;
  details?: string;
}

export interface ParityTestSuite {
  name: string;
  directive: string;
  cases: ParityTestContext[];
}

/**
 * Known directives that must behave identically in both modes
 */
export const CORE_DIRECTIVES = [
  'zen-bind', 'zen-text', 'zen-html',
  'zen-if', 'zen-else', 'zen-else-if',
  'zen-for', 'zen-key',
  'zen-on', 'zen-model',
  'zen-show', 'zen-hide',
  'zen-class', 'zen-style',
  'zen-attr', 'zen-prop',
  'zen-ref', 'zen-effect',
  'zen-error', 'zen-loading',
  'zen-fetch', 'zen-resource',
  'zen-component', 'zen-slot'
] as const;

/**
 * Standard test suites for core directives
 *
 * These are executed against BOTH runtime and compiler to verify parity.
 */
export const STANDARD_TEST_SUITES: ParityTestSuite[] = [
  {
    name: 'zen-text basic rendering',
    directive: 'zen-text',
    cases: [
      { state: { name: 'Ali' }, html: '<div zen-text="name"></div>' },
      { state: { name: 'Sara' }, html: '<span zen-text="name"></span>' },
      { state: { empty: '' }, html: '<p zen-text="empty"></p>' }
    ]
  },
  {
    name: 'zen-bind attribute binding',
    directive: 'zen-bind',
    cases: [
      { state: { url: '/home' }, html: '<a zen-bind:href="url">Link</a>' },
      { state: { disabled: true }, html: '<button zen-bind:disabled="disabled">Btn</button>' }
    ]
  },
  {
    name: 'zen-if conditional rendering',
    directive: 'zen-if',
    cases: [
      { state: { show: true }, html: '<div zen-if="show">Visible</div>' },
      { state: { show: false }, html: '<div zen-if="show">Hidden</div>' }
    ]
  },
  {
    name: 'zen-for list rendering',
    directive: 'zen-for',
    cases: [
      { state: { items: ['a', 'b', 'c'] }, html: '<ul><li zen-for="item in items" zen-text="item"></li></ul>' }
    ]
  },
  {
    name: 'zen-class class binding',
    directive: 'zen-class',
    cases: [
      { state: { active: true }, html: '<div zen-class:active="active">Test</div>' },
      { state: { active: false }, html: '<div zen-class:active="active">Test</div>' }
    ]
  },
  {
    name: 'zen-style style binding',
    directive: 'zen-style',
    cases: [
      { state: { color: 'red' }, html: '<div zen-style:color="color">Test</div>' }
    ]
  },
  {
    name: 'zen-show visibility toggle',
    directive: 'zen-show',
    cases: [
      { state: { visible: true }, html: '<div zen-show="visible">Shown</div>' },
      { state: { visible: false }, html: '<div zen-show="visible">Hidden</div>' }
    ]
  },
  {
    name: 'zen-on event binding',
    directive: 'zen-on',
    cases: [
      { state: { clicked: 0 }, html: '<button zen-on:click="clicked = clicked + 1">Click</button>' }
    ]
  }
];

/**
 * Run a single parity test by comparing runtime and compiler outputs
 */
export function runParityTest(
  suite: ParityTestSuite,
  runtimeRunner: (ctx: ParityTestContext) => string,
  compilerRunner: (ctx: ParityTestContext) => string
): ParityResult[] {
  return suite.cases.map(testCase => {
    const runtimeOutput = runtimeRunner(testCase);
    const compilerOutput = compilerRunner(testCase);
    const match = normalizeOutput(runtimeOutput) === normalizeOutput(compilerOutput);

    return {
      directive: suite.directive,
      runtimeOutput,
      compilerOutput,
      match,
      details: !match ? `Mismatch in suite "${suite.name}"` : undefined
    };
  });
}

/**
 * Normalize HTML output for fair comparison
 *
 * Ignores insignificant whitespace differences
 */
function normalizeOutput(html: string): string {
  return html
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

/**
 * Run all standard parity test suites and return full report
 */
export function runAllParityTests(
  runtimeRunner: (ctx: ParityTestContext) => string,
  compilerRunner: (ctx: ParityTestContext) => string
): { total: number; passed: number; failed: number; results: ParityResult[] } {
  const allResults: ParityResult[] = [];

  for (const suite of STANDARD_TEST_SUITES) {
    const results = runParityTest(suite, runtimeRunner, compilerRunner);
    allResults.push(...results);
  }

  const passed = allResults.filter(r => r.match).length;
  const failed = allResults.length - passed;

  return {
    total: allResults.length,
    passed,
    failed,
    results: allResults
  };
}

/**
 * Generate a human-readable parity report
 */
export function generateParityReport(report: ReturnType<typeof runAllParityTests>): string {
  const lines = [
    '═'.repeat(60),
    '  ZENITH RUNTIME ↔ COMPILER PARITY REPORT',
    '═'.repeat(60),
    `Total tests : ${report.total}`,
    `Passed      : ${report.passed}`,
    `Failed      : ${report.failed}`,
    `Status      : ${report.failed === 0 ? '✅ ALL PARITY CHECKS PASSED' : '⚠️  PARITY MISMATCHES DETECTED'}`,
    '─'.repeat(60)
  ];

  for (const result of report.results) {
    const status = result.match ? '✅' : '❌';
    lines.push(`${status} ${result.directive.padEnd(14)} ${result.match ? 'MATCH' : 'MISMATCH'}`);
    if (!result.match && result.details) {
      lines.push(`    ${result.details}`);
    }
  }

  lines.push('═'.repeat(60));
  return lines.join('\n');
}
