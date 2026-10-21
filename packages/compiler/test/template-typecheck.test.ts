// #111 — type-safe template opt-in: shared engine (compiler side).
// Code-first, unrun. Covers: legacy silence, opt-in unknowns with exact
// spans + suggestions, $ aliasing, strict build-break vs warnings, for/arrow/
// $event scopes, incompatible-type pins, skip-rules, never-throws.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeTemplateTypes,
  compileTemplate,
  type TemplateStateTypes,
} from '@zenith/compiler';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string => readFileSync(join(here, 'fixtures', name), 'utf8');

const SCHEMA: TemplateStateTypes = {
  title: 'string',
  items: 'array',
  submitForm: 'function',
  retryCount: 'number',
  maybeName: 'undefined',
};

describe('analyzeTemplateTypes (#111)', () => {
  it('returns [] without stateTypes (legacy untouched)', () => {
    expect(analyzeTemplateTypes('<div zen-text="$bogus"></div>')).toEqual([]);
    expect(analyzeTemplateTypes('<div zen-text="$bogus"></div>', undefined)).toEqual([]);
  });

  it('flags unknown identifiers with code, kind and exact span', () => {
    const html = '<div zen-text="$foo"></div>';
    const [finding] = analyzeTemplateTypes(html, { title: 'string' });
    expect(finding).toBeDefined();
    expect(finding!.code).toBe('ZEN-502');
    expect(finding!.kind).toBe('unknown-identifier');
    expect(finding!.name).toBe('$foo');
    expect(finding!.line).toBe(0);
    // span دقیقاً روی `$foo` است، نه کل attribute.
    expect(html.slice(finding!.character, finding!.endCharacter)).toBe('$foo');
    expect(finding!.message).toMatch(/compile-time unknown/);
    expect(finding!.message).toMatch(/distinct from a runtime undefined/);
  });

  it('treats $name and name as the same key', () => {
    expect(analyzeTemplateTypes('<div zen-text="$title"></div>', SCHEMA)).toEqual([]);
    expect(analyzeTemplateTypes('<div zen-text="title"></div>', { $title: 'string' })).toEqual([]);
  });

  it('suggests the nearest declared name', () => {
    const [finding] = analyzeTemplateTypes('<div zen-text="$titel"></div>', SCHEMA);
    expect(finding!.suggestion).toBe('$title');
    expect(finding!.message).toContain(`Did you mean '$title'?`);
  });

  it('maps multi-line positions', () => {
    const html = '<div>\n  <span zen-text="$nope"></span>\n</div>';
    const [finding] = analyzeTemplateTypes(html, SCHEMA);
    expect(finding!.line).toBe(1);
    expect(html.split('\n')[1]!.slice(finding!.character, finding!.endCharacter)).toBe('$nope');
  });

  it('keeps for item/index locals (incl. nested) and checks the list expression outside', () => {
    const ok = '<ul><li zen-for="item in $items"><b zen-text="item"></b><i zen-for="(sub, k) in $items"><em zen-text="sub"></em><u zen-text="k"></u></i></li></ul>';
    expect(analyzeTemplateTypes(ok, SCHEMA)).toEqual([]);
    // list expression در scope بیرونی است: `item` آنجا ناشناخته است.
    const [listFinding] = analyzeTemplateTypes('<li zen-for="item in item"></li>', SCHEMA);
    expect(listFinding?.kind).toBe('unknown-identifier');
    // داخل حلقه، نام واقعاً ناشناخته هنوز گرفته می‌شود.
    const [innerFinding] = analyzeTemplateTypes(
      '<li zen-for="item in $items"><b zen-text="bogus"></b></li>',
      SCHEMA,
    );
    expect(innerFinding?.name).toBe('bogus');
  });

  it('checks zen-key inside the for scope', () => {
    expect(
      analyzeTemplateTypes('<li zen-for="item in $items" zen-key="item.id"></li>', SCHEMA),
    ).toEqual([]);
    const [finding] = analyzeTemplateTypes(
      '<li zen-for="item in $items" zen-key="bogus"></li>',
      SCHEMA,
    );
    expect(finding?.name).toBe('bogus');
  });

  it('respects arrow-function params incl. shadowing a state name', () => {
    expect(
      analyzeTemplateTypes('<div zen-text="$items.filter(x => x.ok)"></div>', {
        items: 'array',
      }),
    ).toEqual([]);
    // سایه‌اندازی نام state: `title` اینجا پارامتر است، نه state.
    expect(
      analyzeTemplateTypes('<div zen-text="$items.map(title => title)"></div>', SCHEMA),
    ).toEqual([]);
    // اما نام واقعاً ناشناخته در بدنهٔ arrow گرفته می‌شود.
    const [finding] = analyzeTemplateTypes(
      '<div zen-text="$items.map(x => y)"></div>',
      { items: 'array' },
    );
    expect(finding?.name).toBe('y');
  });

  it('provides $event in actions but not elsewhere', () => {
    expect(
      analyzeTemplateTypes('<button zen-action:click="submitForm($event)">x</button>', SCHEMA),
    ).toEqual([]);
    const [finding] = analyzeTemplateTypes('<div zen-text="$event"></div>', SCHEMA);
    expect(finding?.name).toBe('$event');
  });

  it('checks bare action names (unknown vs non-function)', () => {
    const [unknown] = analyzeTemplateTypes('<button zen-action:click="bogusAction">x</button>', SCHEMA);
    expect(unknown?.kind).toBe('unknown-identifier');
    const [mismatch] = analyzeTemplateTypes(
      '<button zen-action:click="retryCount">x</button>',
      SCHEMA,
    );
    expect(mismatch?.kind).toBe('incompatible-type');
    expect(mismatch?.expected).toBe('function');
    expect(mismatch?.actual).toBe('number');
    // تابع اعلان‌شده پاک است.
    expect(
      analyzeTemplateTypes('<button zen-action:click="submitForm">x</button>', SCHEMA),
    ).toEqual([]);
  });

  it('flags calling a declared non-function', () => {
    const [finding] = analyzeTemplateTypes('<div zen-text="$retryCount()"></div>', SCHEMA);
    expect(finding?.kind).toBe('incompatible-type');
    expect(finding?.expected).toBe('function');
    expect(finding?.actual).toBe('number');
  });

  it('flags non-optional dereference of declared null/undefined, but not `?.`', () => {
    const [finding] = analyzeTemplateTypes('<span zen-text="$maybeName.first"></span>', SCHEMA);
    expect(finding?.kind).toBe('incompatible-type');
    expect(finding?.actual).toBe('undefined');
    expect(
      analyzeTemplateTypes('<span zen-text="$maybeName?.first"></span>', SCHEMA),
    ).toEqual([]);
  });

  it('checks member roots, not properties, and zen-model paths', () => {
    const [member] = analyzeTemplateTypes('<div zen-text="$user.name"></div>', SCHEMA);
    expect(member?.name).toBe('$user');
    const [model] = analyzeTemplateTypes('<input zen-model="$field" />', SCHEMA);
    expect(model?.kind).toBe('unknown-identifier');
    expect(
      analyzeTemplateTypes('<input zen-model="$title" />', SCHEMA),
    ).toEqual([]);
  });

  it('skips non-expression directives and unknown directive values (no false positives)', () => {
    const html = [
      '<div zen-ref="whatever"></div>',
      '<div zen-permission="admin-panel"></div>',
      '<div zen-track="purchase-click"></div>',
      '<div zen-fancy-widget="some string"></div>',
      '<div zen-cloak></div>',
      '<div zen-else></div>',
      '<my-slot zen-slot="header"></my-slot>',
    ].join('\n');
    expect(analyzeTemplateTypes(html, SCHEMA)).toEqual([]);
  });

  it('skips malformed for declarations and unparseable expressions (owned elsewhere)', () => {
    expect(analyzeTemplateTypes('<li zen-for="not a declaration ((("></li>', SCHEMA)).toEqual([]);
    expect(analyzeTemplateTypes('<div zen-text="{{{"></div>', SCHEMA)).toEqual([]);
  });

  it('ignores script/style raw text and never throws on garbage', () => {
    const html = '<script>const t = "<div zen-text=\\"bogus\\">";</script><style>.x{content:"zen-text"}</style>';
    expect(analyzeTemplateTypes(html, SCHEMA)).toEqual([]);
    expect(analyzeTemplateTypes('<<<<<zen-{{{', SCHEMA)).toEqual([]);
    expect(analyzeTemplateTypes('', SCHEMA)).toEqual([]);
  });

  it('runs the validation fixtures', () => {
    expect(analyzeTemplateTypes(fixture('typecheck-ok.html'), SCHEMA)).toEqual([]);
    const unknown = analyzeTemplateTypes(fixture('typecheck-unknown.html'), {
      title: 'string',
      items: 'array',
    });
    expect(unknown.length).toBeGreaterThan(0);
    expect(unknown.every((d) => d.kind === 'unknown-identifier')).toBe(true);
    const mismatch = analyzeTemplateTypes(fixture('typecheck-mismatch.html'), SCHEMA);
    expect(mismatch.length).toBeGreaterThan(0);
    expect(mismatch.every((d) => d.kind === 'incompatible-type')).toBe(true);
  });
});

describe('compileTemplate stateTypes opt-in (#111)', () => {
  it('stays silent in legacy mode (no stateTypes)', async () => {
    const res = await compileTemplate('<div zen-text="$bogus"></div>');
    expect(res.warnings.filter((w) => w.includes('ZEN-502'))).toEqual([]);
    expect(res.effectCount).toBe(1);
  });

  it('breaks the build in strict mode with file/line info', async () => {
    await expect(
      compileTemplate('<div>\n  <span zen-text="$bogus"></span>\n</div>', {
        stateTypes: SCHEMA,
        strict: true,
      }),
    ).rejects.toThrow(/ZEN-502.*line 2/s);
  });

  it('collects warnings without strict, and the build succeeds', async () => {
    const res = await compileTemplate('<div zen-text="$bogus"></div>', { stateTypes: SCHEMA });
    expect(res.effectCount).toBe(1);
    expect(res.warnings.some((w) => w.includes('ZEN-502') && w.includes('$bogus'))).toBe(true);
  });

  it('compiles cleanly when everything is declared', async () => {
    const res = await compileTemplate(fixture('typecheck-ok.html'), {
      stateTypes: SCHEMA,
      strict: true,
    });
    expect(res.warnings.filter((w) => w.includes('ZEN-502'))).toEqual([]);
    expect(res.effectCount).toBeGreaterThan(0);
  });
});
