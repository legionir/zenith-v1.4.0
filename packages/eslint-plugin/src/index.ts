import type { Linter, Rule } from 'eslint';
import { createOptionsObjectRule, optionsObjectRule } from './rules/options-object.js';
import { codeRules } from './rules/code';
import { htmlProcessor, templateRules } from './template';
/** API-CONVENTIONS traceability; template contracts follow NEW-PACKAGES-SPEC §3.10. @public */
export const ruleContracts: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries([
  ['no-console', 'API-CONVENTIONS §4; DEC-031'],
  ['no-plain-error', 'API-CONVENTIONS §4; DEC-031'],
  ['no-destroy-alias', 'API-CONVENTIONS §3/§6.3; DEC-032'],
  ['dispose-required', 'API-CONVENTIONS §1.1/§3'],
  ['no-module-state', 'API-CONVENTIONS §1.2/§1.3; App/request ownership'],
  ['no-math-random-security', 'Security randomness contract #64; spec §3.10'],
  ['no-deprecated-api', 'API-CONVENTIONS §6.3; DEC-019'],
  ['no-global-name-collision', 'API-CONVENTIONS §1.7'],
  ['tsdoc-default', 'API-CONVENTIONS §4; DEC-029'],
  ['options-object', 'API-CONVENTIONS §1.1/§4'],
  ...Object.keys(templateRules).map(name => [name, 'NEW-PACKAGES-SPEC §3.10 templates/APG']),
]));
/** Published rule map (`zenith/*`). @public */
export const rules: Record<string, Rule.RuleModule> = { 'options-object': optionsObjectRule, ...codeRules, ...templateRules };
/** Published ESLint plugin object (rules + processors + configs). @public */
export const plugin: {
  meta: { name: string; version: string };
  rules: Record<string, Rule.RuleModule>;
  processors: Record<string, Linter.Processor>;
  configs: Record<string, Linter.Config[]>;
} = {
  meta: { name: '@zenith/eslint-plugin', version: '1.5.0' }, rules,
  processors: { html: htmlProcessor }, configs: {} as Record<string, Linter.Config[]>,
};
const code: NonNullable<Linter.Config['rules']> = Object.fromEntries(['options-object', ...Object.keys(codeRules)].map(name => [`zenith/${name}`, ['no-module-state', 'no-deprecated-api', 'tsdoc-default'].includes(name) ? 'warn' : 'error']));
const template: NonNullable<Linter.Config['rules']> = Object.fromEntries(Object.keys(templateRules).map(name => [`zenith/${name}`, 'error']));
plugin.configs.recommended = [{ name: 'zenith/recommended', plugins: { zenith: plugin }, rules: { 'zenith/no-console': 'error', 'zenith/no-deprecated-api': 'warn' } }];
plugin.configs.library = [{ name: 'zenith/library', plugins: { zenith: plugin }, rules: code }];
plugin.configs.template = [
  { name: 'zenith/html', files: ['**/*.html'], plugins: { zenith: plugin }, processor: 'zenith/html' },
  { name: 'zenith/template', files: ['**/*.js', '**/*.ts', '**/*.html/*.js'], plugins: { zenith: plugin }, rules: template },
];
plugin.configs.strict = [...plugin.configs.library, ...plugin.configs.template];
/** @public */
export { createOptionsObjectRule, optionsObjectRule, htmlProcessor };
export default plugin;
