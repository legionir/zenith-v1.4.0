import { extractDependencies, type Dependency } from '@zenith/dependency-graph';
import type { CompiledTemplate, CompilerOptions } from './types';
import type { CompileSession } from './session';
import { createParser } from './parser';
import { compileNode } from './walk';

/** Compile source in one isolated session; returned code preserves the renderer ABI. @public */
export async function compileTemplate(html: string, options: CompilerOptions = {}): Promise<CompiledTemplate> {
  const parser = createParser();
  const doc = await parser(html);
  const root = doc.body;
  const dependencies: Dependency[] = [];
  const allExprs: string[] = [];
  const runtimeDirectives: CompiledTemplate['runtimeDirectives'] = [];
  const warnings: string[] = [];
  // تولید کد.
  const codeLines: string[] = [];
  codeLines.push('// Compiled by @zenith/compiler');
  codeLines.push('// SECURITY: sanitizeHTML parameter is used by zen-html to prevent XSS.');
  // v0.3.0: processChildren (7th param) is used by compiled zen-for to delegate
  // per-clone child directive processing to the runtime walker (Zen.start).
  // The vite-plugin wires this param to a function that calls Zen.start(clone,
  // localState). See compileCompilableDirective 'zen-for' case below.
  //
  // FEATURE (v0.4.0): sanitizeHTMLTrusted (8th param) is used by compiled
  // zen-html-trusted. این یک Identity function است (هیچ پاکسازی‌ای نمی‌کند)
  // اما در Dev یک logger.warn چاپ می‌کند تا escape hatch ها قابل‌حسابرسی
  // باشند. vite-plugin آن را از @zenith/security import و تزریق می‌کند.
  // FIX (v1.2.9): BUG-01 — Add evalExpr as 9th parameter for proper expression evaluation.
  // Previously the compiler used dir.value.replace(/^\$/, '') to convert $user → ctx.$user,
  // which broke for complex expressions like !$show, $a > 0, $user.name + ' x'.
  // Now evalExpr (injected from @zenith/expressions.evaluateExpression) handles all expressions.
  codeLines.push(
    'function render(root, ctx, effect, signal, sanitizeHTML, state, processChildren, sanitizeHTMLTrusted, evalExpr, diagnostics = { warn() {}, error() {} }) {',
  );
  // #11 (A7): آرایهٔ dispose برای تمام listenerهای تولیدشده — پس از render،
  // روی root.__zenDispose تابعی قرار می‌گیرد که همهٔ آن‌ها را remove می‌کند
  // (parity با مسیر runtime zen-model که Cleanup برمی‌گرداند).
  codeLines.push('  const __disposers = [];');

  const session: CompileSession = { options, codeLines, allExprs, runtimeDirectives, warnings, elementCount: 0, effectCount: 0, varCounter: 0 };

  // Compile فرزندان root.
  for (const child of Array.from(root.childNodes)) {
    compileNode(child, { session, parentVar: 'root', path: 'root' });
  }

  // #11 (A7): اتصال dispose سراسری صفحهٔ compile — تمام listenerها/handlerهای
  // ثبت‌شده در __disposers را آزاد می‌کند (idempotent). سازگاری: render همچنان
  // root را برمی‌گرداند؛ dispose به‌صورت non-enumerable روی root قرار می‌گیرد.
  codeLines.push('  try {');
  codeLines.push(
    '    Object.defineProperty(root, "__zenDispose", { configurable: true, value: function () {',
  );
  codeLines.push('      for (const d of __disposers.splice(0)) {');
  codeLines.push('        try { d(); } catch (e) { /* teardown best-effort */ }');
  codeLines.push('      }');
  codeLines.push('    } });');
  codeLines.push('  } catch (e) { /* root sealed — dispose unavailable */ }');
  codeLines.push('  return root;');
  codeLines.push('}');

  // استخراج وابستگی‌ها.
  dependencies.push(...extractDependencies(allExprs.join(' + ')));

  return {
    code: codeLines.join('\n'),
    dependencies,
    elementCount: session.elementCount,
    effectCount: session.effectCount,
    isStatic: session.effectCount === 0,
    runtimeDirectives,
    warnings,
  };
}
