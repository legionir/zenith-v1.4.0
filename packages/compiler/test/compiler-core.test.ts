// #27 core tests for @zenith/compiler — compileTemplate output shape,
// directive compilation, dependency extraction, strict mode, delegation.
import { describe, it, expect, vi } from 'vitest';
import { compileTemplate } from '@zenith/compiler';

describe('compileTemplate', () => {
  it('compiles a static template with no effects', async () => {
    const res = await compileTemplate('<div>hello</div>');
    expect(res.isStatic).toBe(true);
    expect(res.effectCount).toBe(0);
    expect(res.elementCount).toBe(1);
    expect(res.code).toContain('function render(');
    expect(res.runtimeDirectives).toEqual([]);
  });

  it('compiles zen-text into an effect and records the expression', async () => {
    const res = await compileTemplate('<span zen-text="$name"></span>');
    expect(res.effectCount).toBe(1);
    expect(res.isStatic).toBe(false);
    expect(res.code).toContain('effect(');
    expect(res.code).toContain('textContent');
    expect(res.runtimeDirectives).toEqual([]);
  });

  it('compiles zen-if with appendChild/removeChild logic', async () => {
    const res = await compileTemplate('<div zen-if="$show"><p>x</p></div>');
    expect(res.code).toContain('appendChild');
    expect(res.code).toContain('removeChild');
    expect(res.effectCount).toBe(1);
  });

  it('always routes zen-html through sanitizeHTML (XSS defense)', async () => {
    const res = await compileTemplate('<div zen-html="$raw"></div>');
    expect(res.code).toMatch(/sanitizeHTML\(/);
    // must not assign innerHTML from raw value directly
    expect(res.code).not.toMatch(/innerHTML\s*=\s*String\(v\)/);
  });

  it('generates a tracked input listener for zen-model that updates the signal', async () => {
    const res = await compileTemplate('<input zen-model="$field" />');
    expect(res.code).toContain("addEventListener('input'");
    expect(res.code).toMatch(/state\.field\.set\(/);
  });

  it('detects dependencies for multi-expression templates', async () => {
    const res = await compileTemplate(
      '<div><span zen-text="$a"></span><b zen-text="$b + $c"></b></div>',
    );
    expect(res.effectCount).toBe(2);
    expect(res.elementCount).toBe(3);
    // dependency extraction from @zenith/dependency-graph
    const depNames = res.dependencies.map((d: any) => String(d.name ?? d.id ?? JSON.stringify(d)));
    const joined = depNames.join(',');
    expect(joined).toMatch(/\$?a/);
    expect(joined).toMatch(/\$?b/);
    expect(joined).toMatch(/\$?c/);
  });

  it('delegates unknown (runtime-only) directives when not strict', async () => {
    const res = await compileTemplate('<div zen-tooltip="$t"></div>');
    expect(res.runtimeDirectives.length).toBe(1);
    expect(res.runtimeDirectives[0]!.directive).toBe('zen-tooltip');
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('throws on unsupported directive in strict mode', async () => {
    await expect(
      compileTemplate('<div zen-tooltip="$t"></div>', { strict: true }),
    ).rejects.toThrow();
  });

  it('warns (console) on conflicting structural directives', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await compileTemplate('<div zen-for="i in $items" zen-if="$show"></div>');
    const out = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(out).toMatch(/conflicting structural directives/i);
    spy.mockRestore();
  });
});
