// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  generateCSP,
  createTrustedTypesPolicy,
  resetTrustedTypesPolicyCache,
  setSafeInnerHTML,
  secureId,
  type TrustedTypePolicyFactory,
} from '../src';
import { evaluateExpression, compileExpression } from '../../expressions/src';

describe('Strict CSP (no unsafe-eval/unsafe-inline) & TrustedTypes (#63)', () => {
  beforeEach(() => {
    resetTrustedTypesPolicyCache();
  });

  afterEach(() => {
    delete window.trustedTypes;
    vi.restoreAllMocks();
  });

  it('generates a strict CSP header with nonce, strict-dynamic, and require-trusted-types-for script', () => {
    const nonce = secureId(8);
    const csp = generateCSP({
      nonce,
      strictDynamic: true,
      requireTrustedTypes: true,
    });

    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
    expect(csp).toContain(`style-src 'self' 'nonce-${nonce}'`);
    expect(csp).toContain(`object-src 'none'`);
    expect(csp).toContain(`base-uri 'self'`);
    expect(csp).toContain(`require-trusted-types-for 'script'`);
    expect(csp).toContain(`trusted-types zenith`);
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain('unsafe-inline');
  });

  it('evaluates expressions without eval() or new Function() under a strict CSP simulation', () => {
    const evalSpy = vi.spyOn(globalThis, 'eval').mockImplementation(() => {
      throw new Error('CSP Violation: unsafe-eval is blocked');
    });

    const fn = compileExpression('$items.length > 0 ? $user.label.toUpperCase() : "EMPTY"');
    const result = fn({
      $items: [1, 2, 3],
      $user: { label: 'zenith' },
    });
    expect(result).toBe('ZENITH');
    expect(
      evaluateExpression('$count + 10', {
        $count: 32,
      }),
    ).toBe(42);
    expect(evalSpy).not.toHaveBeenCalled();
  });

  it('enforces TrustedTypes policy on HTML sinks via createTrustedTypesPolicy and setSafeInnerHTML', () => {
    const createdHTML: string[] = [];
    window.trustedTypes = {
      createPolicy: vi.fn((name: string, rules: Parameters<TrustedTypePolicyFactory['createPolicy']>[1]) => ({
        name,
        createHTML: (input: string) => {
          const clean = rules.createHTML?.(input) ?? input;
          createdHTML.push(clean);
          return clean;
        },
        createScriptURL: rules.createScriptURL ?? ((value: string) => value),
      })),
    };

    const policy1 = createTrustedTypesPolicy();
    const policy2 = createTrustedTypesPolicy();
    expect(policy1).not.toBeNull();
    expect(policy1).toBe(policy2);
    expect(window.trustedTypes?.createPolicy).toHaveBeenCalledTimes(1);

    const container = document.createElement('div');
    setSafeInnerHTML(
      container,
      { html: '<p onclick="alert(1)">Hello <b>World</b></p><script>evil()</script>' },
    );

    expect(createdHTML).toHaveLength(1);
    expect(container.innerHTML).toBe('<p>Hello <b>World</b></p>');
  });

  it('documents strict CSP & TrustedTypes setup in docs/CSP-GUIDE.md', () => {
    const guidePath = join(process.cwd(), 'docs/CSP-GUIDE.md');
    expect(existsSync(guidePath)).toBe(true);
    const content = readFileSync(guidePath, 'utf8');
    expect(content).toContain('strict-dynamic');
    expect(content).toContain("require-trusted-types-for 'script'");
  });
});
