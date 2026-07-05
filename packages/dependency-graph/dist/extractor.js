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
import { compile } from '@zenith/expressions';
/**
 * استخراج وابستگی‌های یک Expression.
 *
 * @param expr رشته‌ی Expression (مثل "$user.name + $count").
 * @returns لیست وابستگی‌ها.
 */
export function extractDependencies(expr) {
    let ast;
    try {
        ast = compile(expr);
    }
    catch {
        return [];
    }
    const deps = [];
    const seen = new Set();
    walk(ast, deps, seen);
    return deps;
}
/**
 * پیمایش بازگشتی AST برای یافتن Identifier های با $.
 */
function walk(node, deps, seen) {
    if (!node || typeof node !== 'object')
        return;
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
            }
            else {
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
 * BUG-6 FIX (v1.2.2): قبلاً parts.pop() آخرین property (leaf) را حذف می‌کرد
 * و parts.reverse() ترتیب را برعکس می‌کرد. هر دو اشتباه بودند. parts هم‌اکنون
 * با unshift در ترتیب root-to-leaf ساخته می‌شود و root Identifier هیچ‌گاه
 * به parts اضافه نمی‌شود. پس نه pop و نه reverse لازم است.
 */
function extractPath(node) {
    const parts = [];
    let current = node;
    while (current && current.type === 'MemberExpression') {
        if (current.computed) {
            // bracket notation: a[b]
            if (current.property.type === 'Literal') {
                parts.unshift(String(current.property.value));
            }
            else {
                // dynamic — نمی‌توانیم در زمان compile بدانیم.
                parts.unshift('*');
            }
        }
        else {
            // dot notation: a.b
            if (current.property.type === 'Identifier') {
                parts.unshift(current.property.name);
            }
        }
        current = current.object;
    }
    // BUG-6 FIX (v1.2.2): parts already in root-to-leaf order; no pop/reverse.
    return parts;
}
/**
 * استخراج وابستگی‌های چند Expression همزمان.
 *
 * @param expressions لیست Expression ها.
 * @returns لیست وابستگی‌های یکپارچه (بدون تکرار).
 */
export function extractAllDependencies(expressions) {
    const all = [];
    const seen = new Set();
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
export function buildDependencyGraph(expressions) {
    const graph = {};
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
export function hasOverlap(deps1, deps2) {
    const set1 = new Set(deps1.map(d => `${d.signal}.${d.path.join('.')}`));
    return deps2.some(d => set1.has(`${d.signal}.${d.path.join('.')}`));
}
//# sourceMappingURL=extractor.js.map