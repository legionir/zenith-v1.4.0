// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { compileTemplate, COMPILABLE_DIRECTIVES, RUNTIME_DIRECTIVES } from '../src';
import * as facade from '../src/compiler';
import { compileTemplate as engine } from '../src/engine';
import * as classifications from '../src/directives';
import { createParser } from '../src/parser';

describe('compiler owner extraction', () => {
  it('retains established factory and mutable classification identities', () => {
    expect(compileTemplate).toBe(engine);
    expect(facade.compileTemplate).toBe(engine);
    expect(COMPILABLE_DIRECTIVES).toBe(classifications.COMPILABLE_DIRECTIVES);
    expect(RUNTIME_DIRECTIVES).toBe(classifications.RUNTIME_DIRECTIVES);
  });
  it('retains the entire static renderer ABI and source order', async () => {
    const result = await compileTemplate('<div class="greeting">hello</div>');
    expect(result.code).toBe([
      '// Compiled by @zenith/compiler',
      '// SECURITY: sanitizeHTML parameter is used by zen-html to prevent XSS.',
      'function render(root, ctx, effect, signal, sanitizeHTML, state, processChildren, sanitizeHTMLTrusted, evalExpr, diagnostics = { warn() {}, error() {} }) {',
      '  const __disposers = [];',
      "  const el0 = document.createElement('div');",
      '  el0.setAttribute(\'class\', "greeting");',
      '  root.appendChild(el0);',
      '  el0.textContent = "hello";',
      '  try {',
      '    Object.defineProperty(root, "__zenDispose", { configurable: true, value: function () {',
      '      for (const d of __disposers.splice(0)) {',
      '        try { d(); } catch (e) { /* teardown best-effort */ }',
      '      }',
      '    } });',
      '  } catch (e) { /* root sealed — dispose unavailable */ }',
      '  return root;',
      '}',
    ].join('\n'));
    expect(result).toMatchObject({ elementCount: 1, effectCount: 0, isStatic: true, runtimeDirectives: [], warnings: [] });
  });
  it('shares numbering and effects across value, model and nested-walk owners', async () => {
    const html = '<main><span zen-text="$name"></span><input zen-model="$name"><p zen-show="$visible">OK</p></main>';
    const result = await compileTemplate(html);
    expect(result).toMatchObject({ elementCount: 4, effectCount: 3, isStatic: false });
    expect(result.code).toContain('const __el2InputHandler');
    expect(result.code).toContain('el3.style.display');
    expect(result.code.indexOf('const el1')).toBeLessThan(result.code.indexOf('const el2'));
    expect((await compileTemplate(html)).code).toBe(result.code);
    expect((await compileTemplate('<b>next</b>')).code).toContain('const el0');
  });
  it('keeps failed-bind bookkeeping and duplicate fallback diagnostics in their original order', async () => {
    const result = await compileTemplate('<p zen-bind:class="{}"></p>');
    expect(result.effectCount).toBe(1);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain('could not be compiled');
    expect(result.warnings[1]).toContain('is not compilable');
    expect(result.runtimeDirectives).toEqual([{ directive: 'zen-bind:class', value: '{}', elementPath: 'root > p#el0' }]);
    await expect(compileTemplate('<p zen-bind:class="{}"></p>', { strict: true })).rejects.toThrow('could not be compiled');
  });
  it('embeds loop children and preserves sibling directives without compiling them twice', async () => {
    const result = await compileTemplate('<ul><li zen-for="item in $items" zen-key="item.id" zen-show="$visible"><span zen-text="item.name"></span></li></ul>');
    expect(result).toMatchObject({ elementCount: 2, effectCount: 1, runtimeDirectives: [] });
    expect(result.code).toContain('__forItems_el1');
    expect(result.code).toContain('zen-text');
    expect(result.code).toContain('setAttribute("zen-show", "$visible")');
    expect(result.code).not.toContain("document.createElement('span')");
    expect(result.code).toContain('processChildren(__clone, __localState)');
  });
  it('keeps runtime and unknown fallback paths, hints, source paths and strict throws', async () => {
    const result = await compileTemplate('<section><p zen-action="save"></p><i zen-unknown="x"></i></section>');
    expect(result.runtimeDirectives.map(item => item.elementPath)).toEqual(['root > section#el0 > p#el1', 'root > section#el0 > i#el2']);
    expect(result.warnings.some(message => message.includes('Hint:'))).toBe(true);
    expect(result.warnings.some(message => message.includes('Unknown directive'))).toBe(true);
    await expect(compileTemplate('<p zen-action="save"></p>', { strict: true })).rejects.toThrow('zen-action');
  });
  it('honestly exposes a synchronous parser when DOMParser exists', () => {
    const document = createParser()('<p>browser</p>');
    expect(document).not.toBeInstanceOf(Promise);
    expect(document).toHaveProperty('body.textContent', 'browser');
  });
});
it('retains generated sanitizer hooks and input-disposal registration after emitter extraction', async () => {
  const result = await compileTemplate('<p zen-html="$content"></p><p zen-html-trusted="$trusted"></p><input zen-model="$name">');
  expect(result.effectCount).toBe(3);
  expect(result.code).toContain('sanitizeHTML('); expect(result.code).toContain('sanitizeHTMLTrusted(');
  expect(result.code).toContain("__disposers.push(() => el2.removeEventListener('input', __el2InputHandler))");
});
