// Justified axe-core exceptions for the #99 gate. Keep this list EMPTY unless a rule
// cannot be satisfied for a documented reason; every entry must say why and where.
export type A11yAllow = {
  rule: string;
  /** '*' = every scanned page, otherwise the exact page paths */
  pages: '*' | readonly string[];
  reason: string;
};

export const A11Y_ALLOWLIST: readonly A11yAllow[] = [];
