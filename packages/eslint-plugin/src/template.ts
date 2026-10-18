import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { compile } from '@zenith/expressions';
import { getRegisteredDirectiveMetas } from '@zenith/schema';
import type { Linter, Rule } from 'eslint';

type Element = DefaultTreeAdapterMap['element'];
interface Issue { rule: string; message: string; offset: number; endOffset: number }
export const templateRuleNames = ['valid-directive', 'no-unknown-directive', 'no-unknown-option', 'require-key-in-for', 'no-structural-conflict', 'valid-expression', 'no-forbidden-identifier', 'a11y/button-name', 'a11y/img-alt', 'a11y/form-label', 'a11y/no-positive-tabindex', 'a11y/dialog-label'] as const;
const builtins = new Set('text html html-trusted if else else-if for key show hide model bind on action ref cloak component props slot fetch fetch-options fetch-state resource resource-options resource-state loading error empty suspense transition transition-options portal permission role i18n t locale dir focus trap-focus autofocus scroll-lock inert announce reduced-motion head title meta link script dialog popover tooltip tabs tab panel menu menu-item accordion accordion-trigger accordion-panel combobox date-picker auth auth-role auth-permission link validate virtual-list item-height buffer dynamic-heights html-slot static animate intersection error-text optimistic track virtual island memo action-button auth-view resource-view route outlet router form field submit store login logout'.split(' ').map(n => `zen-${n}`));
const expressionDirectives = new Set(['zen-text', 'zen-html', 'zen-html-trusted', 'zen-if', 'zen-else-if', 'zen-show', 'zen-hide', 'zen-bind', 'zen-model', 'zen-key']);
const configuration = new Set(['zen-props', 'zen-fetch-options', 'zen-resource-options', 'zen-transition-options']);
/** Parse, never evaluate. Shared by HTML and JS template-literal diagnostics. */
export function inspectTemplate(html: string, settings: Readonly<Record<string, unknown>> = {}): Issue[] {
  const issues: Issue[] = []; const elements: Element[] = [];
  const root = parseFragment(html, { sourceCodeLocationInfo: true });
  function walk(node: DefaultTreeAdapterMap['node']): void {
    if ('tagName' in node) elements.push(node);
    if ('childNodes' in node) for (const child of node.childNodes) walk(child);
    if ('tagName' in node && node.tagName === 'template') walk((node as DefaultTreeAdapterMap['template']).content);
  }
  walk(root);
  const optionMetadata = settings.options && typeof settings.options === 'object' ? settings.options as Record<string, unknown> : {};
  const custom = Array.isArray(settings.directives) ? settings.directives.filter((v): v is string => typeof v === 'string') : [];
  const allowed = new Set([...builtins, ...custom]);
  for (const meta of getRegisteredDirectiveMetas()) { allowed.add(meta.name); for (const attr of meta.attributes ?? []) allowed.add(attr); }
  const ids = new Set(elements.flatMap(el => el.attrs.filter(a => a.name === 'id').map(a => a.value)));
  const text = (el: Element): string => el.childNodes.map(n => 'value' in n ? n.value : 'tagName' in n ? text(n) : '').join('').trim();
  for (const el of elements) {
    const attrs = new Map(el.attrs.map(attr => [attr.name, attr.value]));
    const add = (rule: string, message: string, attr?: string) => { const loc = attr ? el.sourceCodeLocation?.attrs?.[attr] : el.sourceCodeLocation; issues.push({ rule, message, offset: loc?.startOffset ?? 0, endOffset: loc?.endOffset ?? 0 }); };
    const labelled = () => Boolean(attrs.get('aria-label')?.trim() || attrs.get('aria-labelledby')?.split(/\s+/).some(id => ids.has(id)));
    for (const attr of el.attrs) {
      if (!attr.name.startsWith('zen-')) continue;
      const base = attr.name.split(':')[0]!.split('.')[0]!;
      if (!allowed.has(base)) add('no-unknown-directive', `Unknown Zenith directive ${attr.name}.`, attr.name);
      if (expressionDirectives.has(base) && !attr.value.trim()) add('valid-directive', `${attr.name} requires an expression.`, attr.name);
      if (expressionDirectives.has(base) && attr.value.trim()) {
        try { compile(attr.value); } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid expression.';
          add(/forbidden|security|blocked|not allowed/i.test(message) ? 'no-forbidden-identifier' : 'valid-expression', message, attr.name);
        }
      }
      if (configuration.has(base) && attr.value.trim()) {
        try { const value: unknown = JSON.parse(attr.value); if (!value || typeof value !== 'object' || Array.isArray(value)) add('no-unknown-option', `${attr.name} must contain a JSON options object.`, attr.name); else { const known = optionMetadata[base]; if (Array.isArray(known)) for (const key of Object.keys(value)) if (!known.includes(key)) add('no-unknown-option', `Unknown ${attr.name} option ${key}.`, attr.name); } }
        catch { add('no-unknown-option', `${attr.name} must contain valid JSON.`, attr.name); }
      }
    }
    if (attrs.has('zen-for')) {
      if (!attrs.get('zen-key')?.trim()) add('require-key-in-for', 'zen-for requires a stable zen-key.', 'zen-for');
      const match = /^\s*(?:\([^()]+\)|[$\w]+)\s+(?:in|of)\s+(.+)$/.exec(attrs.get('zen-for')!);
      if (!match) add('valid-directive', 'Expected item in collection or (item, index) in collection.', 'zen-for');
      else { try { compile(match[1]!); } catch { add('valid-expression', 'Invalid zen-for collection expression.', 'zen-for'); } }
    }
    if (attrs.has('zen-for') && attrs.has('zen-if') || attrs.has('zen-if') && (attrs.has('zen-else') || attrs.has('zen-else-if'))) add('no-structural-conflict', 'Put competing structural directives on separate elements.');
    if (el.tagName === 'button' && !labelled() && !text(el) && !attrs.has('zen-text') && !el.childNodes.some(n => 'tagName' in n && n.tagName === 'img' && n.attrs.some(a => a.name === 'alt' && a.value.trim()))) add('a11y/button-name', 'Button needs an accessible name.');
    if (el.tagName === 'img' && !attrs.has('alt')) add('a11y/img-alt', 'Image needs alt, including alt="" for decorative images.');
    if (['input', 'select', 'textarea'].includes(el.tagName) && !['hidden', 'submit', 'button', 'reset', 'image'].includes(attrs.get('type') ?? '') && !labelled()) {
      const id = attrs.get('id'); let parent = el.parentNode; let nestedLabel = false;
      while (parent) { if ('tagName' in parent && parent.tagName === 'label') { nestedLabel = true; break; } parent = 'parentNode' in parent ? parent.parentNode : null; }
      if (!nestedLabel && !elements.some(other => other.tagName === 'label' && other.attrs.some(a => a.name === 'for' && a.value === id))) add('a11y/form-label', 'Form control needs an associated label.');
    }
    if (Number(attrs.get('tabindex')) > 0) add('a11y/no-positive-tabindex', 'Use tabindex="0" or "-1", not positive tab order.', 'tabindex');
    if ((el.tagName === 'dialog' || ['dialog', 'alertdialog'].includes(attrs.get('role') ?? '')) && !labelled()) add('a11y/dialog-label', 'Dialog needs an accessible label.');
  }
  return issues;
}
const encode = (text: string): string => JSON.stringify(text).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const virtualPrefix = 'export default ';
interface Mapping { positions: number[]; lines: number[] }
const mappings = new Map<string, Mapping>();
export const htmlProcessor: Linter.Processor = {
  meta: { name: 'zenith/html', version: '1.5.0' }, supportsAutofix: false,
  preprocess(text, filename) {
    const positions = [virtualPrefix.length + 1]; const lines = [0];
    for (let i = 0; i < text.length; i++) {
      positions.push(positions[i]! + encode(text[i]!).length - 2);
      if (text[i] === '\n' || text[i] === '\r' && text[i + 1] !== '\n') lines.push(i + 1);
    }
    mappings.set(filename, { positions, lines });
    return [{ text: virtualPrefix + encode(text) + ';', filename: 'zenith-template.js' }];
  },
  postprocess(blocks, filename) {
    const mapping = mappings.get(filename); mappings.delete(filename);
    if (!mapping) return blocks.flat();
    const locate = (column: number): { line: number; column: number } => {
      let lo = 0; let hi = mapping.positions.length - 1;
      while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (mapping.positions[mid]! <= column - 1) lo = mid; else hi = mid - 1; }
      const offset = lo; lo = 0; hi = mapping.lines.length - 1;
      while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (mapping.lines[mid]! <= offset) lo = mid; else hi = mid - 1; }
      return { line: lo + 1, column: offset - mapping.lines[lo]! + 1 };
    };
    return blocks.flat().map(message => {
      const mapped = { ...message, ...locate(message.column) }; delete mapped.fix; delete mapped.suggestions;
      if (message.endColumn !== undefined) { const end = locate(message.endColumn); mapped.endLine = end.line; mapped.endColumn = end.column; }
      return mapped;
    });
  },
};

function ruleFor(ruleName: string): Rule.RuleModule {
  return { meta: { type: 'problem', docs: { description: `Zenith template ${ruleName}` }, schema: [], messages: { template: '{{message}}' } }, create(context) {
    const visit = (node: Rule.Node) => {
      const dynamic: Array<{ start: number; end: number }> = [];
      let html: string; let offset: (index: number) => number;
      if (node.type === 'Literal' && typeof node.value === 'string' && node.parent?.type === 'ExportDefaultDeclaration' && context.filename.includes('.html/')) {
        html = node.value; offset = index => node.range![0] + encode(html.slice(0, index)).length - 1;
      } else if (node.type === 'TemplateLiteral') {
        html = context.sourceCode.getText(node).slice(1, -1); if (!/^\s*</.test(html)) return;
        const chars = html.split('');
        for (const expression of node.expressions) {
          const start = html.lastIndexOf('${', expression.range![0] - node.range![0] - 1);
          const end = html.indexOf('}', expression.range![1] - node.range![0] - 1);
          if (start >= 0 && end >= start) { dynamic.push({ start, end }); for (let i = start; i <= end; i++) if (chars[i] !== '\n') chars[i] = ' '; }
        }
        html = chars.join(''); offset = index => node.range![0] + 1 + index;
      } else return;
      const settings = context.settings.zenith;
      for (const issue of inspectTemplate(html, settings && typeof settings === 'object' ? settings as Record<string, unknown> : {})) {
        if (issue.rule !== ruleName) continue;
        if (['valid-directive', 'valid-expression', 'no-forbidden-identifier', 'no-unknown-option'].includes(issue.rule) && dynamic.some(span => span.start < issue.endOffset && span.end >= issue.offset)) continue;
        context.report({ loc: context.sourceCode.getLocFromIndex(offset(issue.offset)), messageId: 'template', data: { message: issue.message } });
      }
    };
    return { Literal: visit, TemplateLiteral: visit };
  } };
}
export const templateRules: Record<string, Rule.RuleModule> = Object.fromEntries(templateRuleNames.map(name => [`template/${name}`, ruleFor(name)]));
