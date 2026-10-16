// @vitest-environment node
// Execute trusted, locally generated compiler output, not an echoRenderer.
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compileTemplate } from '../src/index';
import { evaluateExpression } from '@zenith/expressions';

type Sanitizer = (html: string) => string;
type GeneratedRender = (
  root: HTMLElement,
  ctx: Record<string, unknown>,
  effect: (fn: () => void) => void,
  signal: unknown,
  sanitize: Sanitizer,
  state: unknown,
  processChildren: unknown,
  trusted: Sanitizer | undefined,
  evaluate: typeof evaluateExpression,
) => HTMLElement;

const windows: JSDOM[] = [];
afterEach(() => {
  for (const dom of windows.splice(0)) dom.window.close();
  vi.restoreAllMocks();
});

async function renderFixture(
  html: string,
  ctx: Record<string, unknown>,
  sanitize: Sanitizer = (s) => s,
  trusted?: Sanitizer,
) {
  const compiled = await compileTemplate(html);
  const dom = new JSDOM('<!doctype html><body><main></main></body>');
  windows.push(dom);
  const root = dom.window.document.querySelector('main')!;
  // No eval/new Function in library code. VM input is compiler output from the
  // fixed test fixture; expression evaluation still uses the real Zenith AST.
  const render = runInNewContext(`${compiled.code}\nrender`, {
    document: dom.window.document,
  }) as GeneratedRender;
  const effects: Array<() => void> = [];
  expect(
    render(
      root,
      ctx,
      (fn) => {
        effects.push(fn);
        fn();
      },
      undefined,
      sanitize,
      {},
      undefined,
      trusted,
      evaluateExpression,
    ),
  ).toBe(root);
  return {
    root,
    update: () => {
      for (const fn of effects) fn();
    },
    compiled,
  };
}

describe('generated renderer behavior after toolchain upgrade (#13 / #29)', () => {
  it('evaluates text expressions without referencing compiler-local dir, including null updates', async () => {
    const ctx: Record<string, unknown> = { $value: 'Ada' };
    const { root, update } = await renderFixture('<p zen-text="$value"></p>', ctx);
    expect(root.textContent).toBe('Ada');
    ctx.$value = 'Grace';
    update();
    expect(root.textContent).toBe('Grace');
    ctx.$value = null;
    update();
    expect(root.textContent).toBe('');
  });

  it('serializes quotes inside expressions as data in generated JavaScript', async () => {
    const { root } = await renderFixture('<p zen-text="$value + \'&quot;quoted&quot;\'"></p>', {
      $value: 'Ada',
    });
    expect(root.textContent).toBe('Ada"quoted"');
  });

  it('uses the serialized if expression when detaching and reattaching the same element', async () => {
    const ctx = { $visible: true };
    const { root, update } = await renderFixture('<p zen-if="$visible">Visible</p>', ctx);
    const original = root.firstElementChild;
    expect(original?.textContent).toBe('Visible');
    ctx.$visible = false;
    update();
    expect(root.childElementCount).toBe(0);
    ctx.$visible = true;
    update();
    expect(root.firstElementChild).toBe(original);
  });

  it('uses the serialized show expression to update display', async () => {
    const ctx = { $visible: false };
    const { root, update } = await renderFixture('<p zen-show="$visible">Visible</p>', ctx);
    expect(root.querySelector('p')?.style.display).toBe('none');
    ctx.$visible = true;
    update();
    expect(root.querySelector('p')?.style.display).toBe('');
  });

  it.each(['zen-html', 'zen-html-trusted'])(
    '%s invokes the safe sanitizer when no trusted escape hatch is supplied',
    async (directive) => {
      const raw = '<img src=x onerror="unsafe()">';
      const ctx: Record<string, unknown> = { $html: raw };
      const sanitize = vi.fn(() => '<em>safe</em>');
      const { root, update } = await renderFixture(
        `<section ${directive}="$html"></section>`,
        ctx,
        sanitize,
      );
      expect(sanitize).toHaveBeenCalledExactlyOnceWith(raw);
      expect(root.querySelector('section')?.innerHTML).toBe('<em>safe</em>');
      expect(root.querySelector('[onerror]')).toBeNull();
      ctx.$html = null;
      update();
      expect(root.querySelector('section')?.innerHTML).toBe('');
      expect(sanitize).toHaveBeenCalledTimes(1);
    },
  );

  it('uses an explicitly supplied trusted sanitizer only for the trusted directive', async () => {
    const trusted = vi.fn((s: string) => s);
    const sanitize = vi.fn(() => 'safe');
    const { root } = await renderFixture(
      '<section zen-html-trusted="$html"></section>',
      { $html: '<b>approved</b>' },
      sanitize,
      trusted,
    );
    expect(trusted).toHaveBeenCalledExactlyOnceWith('<b>approved</b>');
    expect(sanitize).not.toHaveBeenCalled();
    expect(root.querySelector('b')?.textContent).toBe('approved');
  });

  it('adds and removes object-syntax classes using the real expression evaluator', async () => {
    const ctx = { $active: true, $disabled: false };
    const { root, update, compiled } = await renderFixture(
      '<button zen-bind:class="{ active: $active, disabled: $disabled }">Action</button>',
      ctx,
    );
    expect(compiled.runtimeDirectives).toEqual([]);
    expect(root.querySelector('button')?.className).toBe('active');
    ctx.$active = false;
    ctx.$disabled = true;
    update();
    expect(root.querySelector('button')?.className).toBe('disabled');
  });

  it('removes a boolean attribute when its expression becomes false', async () => {
    const ctx = { $disabled: true };
    const { root, update } = await renderFixture(
      '<button zen-bind:disabled="$disabled">Action</button>',
      ctx,
    );
    expect(root.querySelector('button')?.hasAttribute('disabled')).toBe(true);
    ctx.$disabled = false;
    update();
    expect(root.querySelector('button')?.hasAttribute('disabled')).toBe(false);
  });

  it.each(['{ malformed }', '{ : $active }', '{ active: }', '{}'])(
    'preserves non-compilable binding %s for runtime and reports its fallback',
    async (value) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { root, compiled } = await renderFixture(`<p zen-bind:class="${value}"></p>`, {
        $active: true,
      });
      expect(compiled.runtimeDirectives).toEqual([
        expect.objectContaining({ directive: 'zen-bind:class', value }),
      ]);
      expect(compiled.warnings.join(' ')).toContain('could not be compiled');
      expect(root.querySelector('p')?.getAttribute('zen-bind:class')).toBe(value);
      expect(root.querySelector('p')?.getAttribute('data-zenith-runtime')).toBe('true');
      expect(warn).toHaveBeenCalled();
    },
  );

  it('rejects the same malformed binding in strict mode rather than silently emitting fallback', async () => {
    await expect(
      compileTemplate('<p zen-bind:class="{ malformed }"></p>', { strict: true }),
    ).rejects.toThrow('could not be compiled');
  });
});
