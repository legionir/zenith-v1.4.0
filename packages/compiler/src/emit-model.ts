import type { DirectiveInfo } from './syntax-types';
import type { DirectiveInput } from './session';
/** Emit in the original directive order and shared session. @internal */
export function emitModelDirective(dir: DirectiveInfo, input: DirectiveInput): boolean {
  const { session, varName } = input;
  const { codeLines, allExprs } = session;
  if (dir.name === 'zen-model') {
    // zen-model برای two-way binding روی input/textarea/select
    // نیاز به event listener دارد.
    //
    // BUG FIX (v7.0): قبلاً کد `ctx.$fieldName = e.target.value` تولید می‌شد
    // که شکست می‌خورد چون ctx.$fieldName یک getter-only property است (با
    // Object.defineProperty) و setter ندارد → assignment در non-strict mode
    // silently fail می‌شد و در strict mode TypeError می‌داد. هیچ Signal ای
    // آپدیت نمی‌شد و two-way binding در صفحات کامپایل‌شده از کار می‌افتاد.
    //
    // راه‌حل: state (آبجکت خام شامل خود Signalها) به‌عنوان پارامتر ششم
    // render پاس داده می‌شود. در event listener، state[fieldName].set(value)
    // فراخوانی می‌شود تا Signal واقعی آپدیت شود. اگر state در دسترس نبود
    // (backward-compat با صفحاتی که state پاس نمی‌دهند)، fallback به ctx با
    // یک warning چاپ می‌شود.
    const fieldName = dir.value.replace(/^\$/, '');
    allExprs.push(dir.value);
    session.effectCount++;
    // initial value (از ctx خوانده می‌شود — getter کار می‌کند).
    codeLines.push(`  effect(() => {`);
    codeLines.push(`    const v = ctx.$${fieldName};`);
    codeLines.push(
      `    if (${varName}.value !== String(v ?? '')) ${varName}.value = String(v ?? '');`,
    );
    codeLines.push(`  });`);
    // event listener for two-way binding — از state (Signal) برای set استفاده کن.
    // #11 (A7): handler نام‌دار + ثبت در __disposers تا root.__zenDispose بتواند
    // آن را removeEventListener کند (رفع نشت listenerهای input با mount/unmount مکرر).
    codeLines.push(`  const __${varName}InputHandler = (e) => {`);
    codeLines.push(
      `    if (state && state.${fieldName} && typeof state.${fieldName}.set === 'function') {`,
    );
    codeLines.push(`      state.${fieldName}.set(e.target.value);`);
    codeLines.push(`    } else if (state && state.${fieldName}) {`);
    codeLines.push(`      state.${fieldName} = e.target.value;`);
    codeLines.push(`    } else {`);
    codeLines.push(
      `      diagnostics.warn(${JSON.stringify('[Zenith Compiler] zen-model: state not provided to render(). Two-way binding disabled.')});`,
    );
    codeLines.push(`    }`);
    codeLines.push(`  };`);
    codeLines.push(`  ${varName}.addEventListener('input', __${varName}InputHandler);`);
    codeLines.push(
      `  __disposers.push(() => ${varName}.removeEventListener('input', __${varName}InputHandler));`,
    );
    return true;
  }


  return false;
}
