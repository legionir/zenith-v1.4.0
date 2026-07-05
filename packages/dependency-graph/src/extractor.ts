// packages/dependency-graph/src/extractor.ts
//
// Dependency Graph — استخراج وابستگی‌های Expression از AST.
//
// این ماژول یک Expression را گرفته و لیست تمام Signal های که به آن وابسته است
// را استخراج می‌کند. این کار برای:
//   - Pre-computing render targets
//   - Optimizing update paths
//   - Debugging و visualization
//   - Compiler optimizations (tree-shaking dead code)
//
// مثال:
//   extractDependencies("$user.name + ' ' + $count")
//   → [{ signal: 'user', path: ['name'] }, { signal: 'count', path: [] }]

import { compile, type ASTNode } from '@zenith/expressions';

/**
 * یک وابستگی به یک Signal.
 */
export interface Dependency {
  /** نام Signal در state (بدون $). */
  signal: string;
  /** مسیر پراپرتی‌ها (مثل ['user', 'name']). */
  path: string[];
  /** آیا از bracket notation استفاده شده؟ */
  computed: boolean;
}

/**
 * استخراج وابستگی‌های یک Expression.
 *
 * @param expr رشته‌ی Expression (مثل "$user.name + $count").
 * @returns لیست وابستگی‌ها.
 */
export function extractDependencies(expr: string): Dependency[] {
  let ast: ASTNode;
  try {
    ast = compile(expr);
  } catch {
    return [];
  }

  const deps: Dependency[] = [];
  const seen = new Set<string>();

  walk(ast, deps, seen);

  return deps;
}

/**
 * پیمایش بازگشتی AST برای یافتن Identifier های با $.
 */
function walk(node: ASTNode, deps: Dependency[], seen: Set<string>): void {
  if (!node || typeof node !== 'object') return;

  switch (node.type) {
    case 'Identifier': {
      // فقط Identifier های با $ پیشوند.
      if (node.name.startsWith('$')) {
        const signalName = node.name.slice(1);
        const key = signalName;
        if (!seen.has(key)) {
          seen.add(key);
          deps.push({ signal: signalName, path: [], computed: false });
        }
      }
      break;
    }

    case 'MemberExpression': {
      // اگر object یک Identifier با $ است، این یک وابستگی با path است.
      if (node.object.type === 'Identifier' && node.object.name.startsWith('$')) {
        const signalName = node.object.name.slice(1);
        const path = extractPath(node);
        const key = `${signalName}.${path.join('.')}`;
        if (!seen.has(key)) {
          seen.add(key);
          deps.push({ signal: signalName, path, computed: node.computed });
        }
      } else {
        // به‌صورت بازگشتی object را walk کن.
        walk(node.object, deps, seen);
      }
      // property را هم walk کن (در حالت computed).
      if (node.computed) {
        walk(node.property, deps, seen);
      }
      break;
    }

    case 'CallExpression':
      walk(node.callee, deps, seen);
      node.args.forEach(arg => walk(arg, deps, seen));
      break;

    case 'BinaryExpression':
    case 'LogicalExpression':
      walk(node.left, deps, seen);
      walk(node.right, deps, seen);
      break;

    case 'UnaryExpression':
      walk(node.argument, deps, seen);
      break;

    case 'ConditionalExpression':
      walk(node.test, deps, seen);
      walk(node.consequent, deps, seen);
      walk(node.alternate, deps, seen);
      break;

    case 'ObjectExpression':
      node.properties.forEach(prop => walk(prop.value, deps, seen));
      break;

    case 'Literal':
      // هیچ وابستگی‌ای ندارد.
      break;
  }
}

/**
 * استخراج path از یک MemberExpression.
 *
 * مثال: $user.name → ['user', 'name']  ← WAIT: این مثال قدیمی است.
 *
 * BUG-6 FIX (v1.2.2): قبلاً extractPath دو کار اشتباه انجام می‌داد:
 *   1) `parts.pop()` — با این حال که کامنت می‌گفت root identifier name
 *      را حذف می‌کند، در واقع آخرین property (که leaf است) را حذف می‌کرد.
 *      چون حلقه‌ی while فقط propertyها را به parts اضافه می‌کند (و در پایان
 *      current به root Identifier می‌رسد که هرگز push نمی‌شود)، parts اصلاً
 *      شامل root identifier name نیست. پس pop() یک property معتبر را حذف
 *      می‌کرد. مثال: $user.name → parts=['name'] → بعد از pop: parts=[] →
 *      path غیب می‌شد.
 *   2) `parts.reverse()` — چون در حلقه از `unshift` استفاده می‌کنیم، parts
 *      از ابتدا به‌صورت root-to-leaf مرتب است. reverse ترتیب را برعکس
 *      می‌کرد و path را از leaf-to-root می‌ساخت.
 *
 * راه‌حل: نه pop، نه reverse. parts هم‌اکنون در ترتیب درست است.
 *
 * مثال صحیح:
 *   $user.name       → ['name']
 *   $items[0].name   → ['0', 'name']
 *   $a.b.c           → ['b', 'c']
 */
function extractPath(node: ASTNode): string[] {
  const parts: string[] = [];
  let current: ASTNode | undefined = node;

  while (current && current.type === 'MemberExpression') {
    if (current.computed) {
      // bracket notation: a[b]
      if (current.property.type === 'Literal') {
        parts.unshift(String(current.property.value));
      } else {
        // dynamic — نمی‌توانیم در زمان compile بدانیم.
        parts.unshift('*');
      }
    } else {
      // dot notation: a.b
      if (current.property.type === 'Identifier') {
        parts.unshift(current.property.name);
      }
    }
    current = current.object;
  }

  // BUG-6 FIX (v1.2.2): نه parts.pop() و نه parts.reverse() لازم نیست.
  // حلقه‌ی unshift بالا parts را از ابتدا در ترتیب root-to-leaf می‌سازد و
  // root Identifier (که current بعد از حلقه به آن اشاره می‌کند) هرگز به
  // parts اضافه نشده. پس parts همان path نهایی است.
  return parts;
}

/**
 * استخراج وابستگی‌های چند Expression همزمان.
 *
 * @param expressions لیست Expression ها.
 * @returns لیست وابستگی‌های یکپارچه (بدون تکرار).
 */
export function extractAllDependencies(expressions: string[]): Dependency[] {
  const all: Dependency[] = [];
  const seen = new Set<string>();

  for (const expr of expressions) {
    const deps = extractDependencies(expr);
    for (const dep of deps) {
      const key = `${dep.signal}.${dep.path.join('.')}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(dep);
      }
    }
  }

  return all;
}

/**
 * ساخت یک Dependency Graph از لیست Expression ها.
 *
 * @param expressions Map از نام به Expression.
 * @returns Map از نام به وابستگی‌ها.
 */
export function buildDependencyGraph(
  expressions: Record<string, string>,
): Record<string, Dependency[]> {
  const graph: Record<string, Dependency[]> = {};

  for (const [name, expr] of Object.entries(expressions)) {
    graph[name] = extractDependencies(expr);
  }

  return graph;
}

/**
 * بررسی اینکه آیا دو مجموعه وابستگی اشتراک دارند.
 *
 * @param deps1 مجموعه اول.
 * @param deps2 مجموعه دوم.
 * @returns true اگر اشتراک دارند.
 */
export function hasOverlap(deps1: Dependency[], deps2: Dependency[]): boolean {
  const set1 = new Set(deps1.map(d => `${d.signal}.${d.path.join('.')}`));
  return deps2.some(d => set1.has(`${d.signal}.${d.path.join('.')}`));
}
