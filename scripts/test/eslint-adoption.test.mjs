import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const CODE_RULES = [
  'no-console',
  'no-plain-error',
  'no-destroy-alias',
  'dispose-required',
  'no-module-state',
  'no-math-random-security',
  'no-deprecated-api',
  'no-global-name-collision',
  'tsdoc-default',
];

function templateRuleNames() {
  const src = read('packages/eslint-plugin/src/template.ts');
  const match = src.match(/export const templateRuleNames = \[(.*?)\] as const/s);
  expect(match, 'templateRuleNames').not.toBeNull();
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => `template/${m[1]}`);
}

/** Count single-quoted fixture strings in one `valid: [...]` / `invalid: [...]` body. */
function countStrings(body) {
  return [...body.matchAll(/'((?:[^'\\]|\\.)*)'/g)].length;
}

/** Per-rule `{ valid, invalid }` counts from the one-line-per-rule fixture files. */
function fixtureCounts(source) {
  const out = {};
  for (const line of source.split('\n')) {
    const match = line.match(/^\s*'([^']+)': \{ valid: \[(.*)\], invalid: \[(.*)\] \},?\s*$/);
    if (match) out[match[1]] = { valid: countStrings(match[2]), invalid: countStrings(match[3]) };
  }
  return out;
}

describe('eslint-plugin adoption contract (#159)', () => {
  it('publishes all four configs with a rule→contract table covering every rule', () => {
    const index = read('packages/eslint-plugin/src/index.ts');
    for (const config of ['recommended', 'library', 'template', 'strict']) {
      expect(index, `configs.${config}`).toContain(`configs.${config}`);
    }
    expect(index).toContain('ruleContracts');
    for (const rule of CODE_RULES) expect(index, `contract ${rule}`).toContain(`'${rule}'`);
    // Template contracts ride the templateRules spread (one row per rule).
    expect(index).toContain('...Object.keys(templateRules)');
    // Options-object stays a local factory (root wires it with the allowlist).
    expect(index).toContain('createOptionsObjectRule');
  });

  it('proves every code rule with at least 5 valid and 5 invalid RuleTester cases', () => {
    const counts = fixtureCounts(read('packages/eslint-plugin/test/code.test.ts'));
    expect(Object.keys(counts).sort()).toEqual([...CODE_RULES].sort());
    for (const [rule, { valid, invalid }] of Object.entries(counts)) {
      expect(valid, `${rule} valid`).toBeGreaterThanOrEqual(5);
      expect(invalid, `${rule} invalid`).toBeGreaterThanOrEqual(5);
    }
  });

  it('proves every template rule with at least 5 valid and 5 invalid RuleTester cases', () => {
    const counts = fixtureCounts(read('packages/eslint-plugin/test/template.test.ts'));
    expect(Object.keys(counts).sort()).toEqual(templateRuleNames().sort());
    for (const [rule, { valid, invalid }] of Object.entries(counts)) {
      expect(valid, `${rule} valid`).toBeGreaterThanOrEqual(5);
      expect(invalid, `${rule} invalid`).toBeGreaterThanOrEqual(5);
    }
  });

  it('proves the main options-object rule with at least 5 valid and 5 invalid cases', () => {
    const src = read('packages/eslint-plugin/test/options-object.test.ts');
    const block = src.match(/tester\.run\('zenith\/options-object', optionsObjectRule, \{(.*?)\n\}\);/s);
    expect(block, 'main options-object run').not.toBeNull();
    const valid = block[1].match(/valid: \[(.*?)\],\n/s);
    expect(valid, 'valid block').not.toBeNull();
    expect(countStrings(valid[1])).toBeGreaterThanOrEqual(5);
    expect([...block[1].matchAll(/\{ code: '/g)].length).toBeGreaterThanOrEqual(5);
  });

  it('consumes the published plugin in the root config (code + template + processor)', () => {
    const config = read('eslint.config.mjs');
    expect(config).toContain('templateContractRules');
    expect(config).toContain("processor: 'zenith/html'");
    expect(config).toContain('zenith/options-object');
    expect(config).toContain('plugins: { zenith: zenithPlugin }');
  });

  it('consumes the plugin in every scaffolded template (config + pinned dep + script)', () => {
    expect(existsSync(join(ROOT, 'packages/templates/templates/shared/eslint.config.mjs'))).toBe(true);
    const sharedPkg = JSON.parse(read('packages/templates/templates/shared/package.json'));
    expect(sharedPkg.scripts.lint).toBe('eslint .');
    expect(sharedPkg.devDependencies['@zenith/eslint-plugin']).toBe('__ZENITH_ESLINT_PLUGIN__');
    // The engine resolves the token to the pinned range (no raw token ships).
    expect(read('packages/templates/src/engine.ts')).toContain('__ZENITH_ESLINT_PLUGIN__');
    expect(read('packages/templates/src/engine.ts')).toContain("'eslint.config.mjs'");
    const versions = read('packages/templates/src/versions.ts');
    expect(versions).toMatch(/'@zenith\/eslint-plugin': '\d+\.\d+\.\d+'/);
  });
});
