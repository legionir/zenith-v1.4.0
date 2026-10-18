import { ZenithError } from '@zenith/errors';

/** @public */
export type A11yImpact = 'minor' | 'moderate' | 'serious' | 'critical';

/** @public */
export interface A11yViolation {
  id: string;
  impact: A11yImpact;
  description: string;
  selector: string;
}

/** @public */
export interface A11yAuditOptions {
  /** Minimum impact level to fail on (default: 'serious') */
  minImpact?: A11yImpact;
  /** Rule IDs to allowlist / ignore */
  allowlist?: readonly string[];
}

/** @public */
export interface A11yAuditResult {
  passes: number;
  violations: A11yViolation[];
}

const IMPACT_RANK: Record<A11yImpact, number> = {
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

function hasAccessibleName(el: Element, root: ParentNode): boolean {
  if ((el.textContent ?? '').trim().length > 0) return true;
  if ((el.getAttribute('aria-label') ?? '').trim().length > 0) return true;
  if ((el.getAttribute('title') ?? '').trim().length > 0) return true;
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy && typeof root.querySelector === 'function') {
    for (const id of labelledBy.split(/\s+/).filter(Boolean)) {
      const ref = root.querySelector(`#${CSS.escape ? CSS.escape(id) : id}`);
      if (ref && (ref.textContent ?? '').trim().length > 0) return true;
    }
  }
  return false;
}

/**
 * #99: Run automated WCAG 2.2 AA accessibility rules against a DOM subtree.
 * @public
 */
export function auditAccessibility(
  root: ParentNode,
  options: A11yAuditOptions = {},
): A11yAuditResult {
  const allow = new Set(options.allowlist ?? []);
  const minRank = IMPACT_RANK[options.minImpact ?? 'serious'];
  const violations: A11yViolation[] = [];
  let passes = 0;

  const pushViolation = (v: A11yViolation) => {
    if (allow.has(v.id)) return;
    if (IMPACT_RANK[v.impact] >= minRank) {
      violations.push(v);
    }
  };

  // 1. image-alt (critical)
  for (const img of Array.from(root.querySelectorAll('img'))) {
    if (
      img.getAttribute('aria-hidden') === 'true' ||
      img.getAttribute('role') === 'presentation' ||
      img.hasAttribute('alt') ||
      hasAccessibleName(img, root)
    ) {
      passes++;
    } else {
      pushViolation({
        id: 'image-alt',
        impact: 'critical',
        description: 'Images must have alternate text (alt attribute or aria-label).',
        selector: img.id ? `img#${img.id}` : 'img',
      });
    }
  }

  // 2. button-name (critical)
  for (const btn of Array.from(root.querySelectorAll('button, [role="button"]'))) {
    if (btn.getAttribute('aria-hidden') === 'true' || hasAccessibleName(btn, root)) {
      passes++;
    } else {
      pushViolation({
        id: 'button-name',
        impact: 'critical',
        description: 'Buttons must have discernible text or aria-label.',
        selector: btn.id ? `#${btn.id}` : btn.tagName.toLowerCase(),
      });
    }
  }

  // 3. label (critical)
  for (const ctrl of Array.from(root.querySelectorAll('input, select, textarea'))) {
    const type = (ctrl.getAttribute('type') ?? 'text').toLowerCase();
    if (['hidden', 'submit', 'reset', 'button', 'image'].includes(type)) continue;
    if (ctrl.getAttribute('aria-hidden') === 'true') continue;
    const id = ctrl.getAttribute('id');
    const hasForLabel = id ? Boolean(root.querySelector(`label[for="${id}"]`)) : false;
    const hasWrapLabel = Boolean(ctrl.closest('label'));
    if (
      hasForLabel ||
      hasWrapLabel ||
      hasAccessibleName(ctrl, root) ||
      (ctrl.getAttribute('placeholder') ?? '').trim().length > 0
    ) {
      passes++;
    } else {
      pushViolation({
        id: 'label',
        impact: 'critical',
        description: 'Form controls must have an associated label or aria-label.',
        selector: id ? `#${id}` : ctrl.tagName.toLowerCase(),
      });
    }
  }

  // 4. link-name (serious)
  for (const link of Array.from(root.querySelectorAll('a[href]'))) {
    if (link.getAttribute('aria-hidden') === 'true' || hasAccessibleName(link, root)) {
      passes++;
    } else {
      pushViolation({
        id: 'link-name',
        impact: 'serious',
        description: 'Links must have discernible text or aria-label.',
        selector: link.id ? `a#${link.id}` : 'a[href]',
      });
    }
  }

  // 5. aria-dialog-name (serious)
  for (const dlg of Array.from(root.querySelectorAll('[role="dialog"], [role="alertdialog"]'))) {
    if (hasAccessibleName(dlg, root)) {
      passes++;
    } else {
      pushViolation({
        id: 'aria-dialog-name',
        impact: 'serious',
        description:
          'Dialogs and alertdialogs must have an accessible name (aria-label or aria-labelledby).',
        selector: dlg.id ? `#${dlg.id}` : '[role="dialog"]',
      });
    }
  }

  // 6. duplicate-id-aria (critical)
  const seenIds = new Set<string>();
  for (const el of Array.from(root.querySelectorAll('[id]'))) {
    const id = el.getAttribute('id')!;
    if (!id) continue;
    if (seenIds.has(id)) {
      pushViolation({
        id: 'duplicate-id-aria',
        impact: 'critical',
        description: `Duplicate id attribute "#${id}" found in DOM.`,
        selector: `#${id}`,
      });
    } else {
      seenIds.add(id);
      passes++;
    }
  }

  return { passes, violations };
}

/**
 * #99 / #137: Assert that a DOM container has zero serious/critical accessibility violations.
 * @public
 */
export function expectAccessible(
  root: ParentNode,
  options: A11yAuditOptions = {},
): A11yAuditResult {
  const result = auditAccessibility(root, options);
  if (result.violations.length > 0) {
    const details = result.violations
      .map((v) => `[${v.impact}] ${v.id} (${v.selector}): ${v.description}`)
      .join('; ');
    throw new ZenithError({
      code: 'ZEN-1403',
      category: 'Validation',
      message: `Accessibility audit failed with ${result.violations.length} violation(s): ${details}`,
      suggestion:
        'خطاهای ARIA/برچسب عناصر را برطرف کنید یا در صورت موجه بودن به allowlist اضافه نمایید.',
      context: { violations: result.violations },
    });
  }
  return result;
}
