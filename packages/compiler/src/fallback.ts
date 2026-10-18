import { logger } from '@zenith/logger';
import type { DirectiveInfo } from './syntax-types';
import type { CompileSession } from './session';
function getStrictHint(dirName: string): string {
  const hintMap: Record<string, string> = {
    'zen-for': ' Use complex expression with simple variable bindings.',
    'zen-action': ' Wrap in a simple action handler or use runtime mode.',
    'zen-fetch': ' Consider extracting fetch logic into a function.',
    'zen-resource': ' Consider extracting resource logic into a function.',
    'zen-link': ' Use standard <a> with href for basic links.',
    'zen-permission': ' Use runtime permission checks instead.',
    'zen-role': ' Use runtime role checks instead.',
    'zen-error': ' Use zen-if with error state for better compilation.',
    'zen-suspense': ' Use standard loading state pattern.',
    'zen-virtual-list': ' Ensure zen-dynamic-heights and zen-item-height are set.',
    'zen-component': ' Use standard HTML elements with zen-bind for props.',
    'zen-validate': ' Implement inline validation in action handler.',
    'zen-transition': ' Use CSS transitions with zen-show instead.',
  };
  const hint = hintMap[dirName];
  return hint ? ` Hint: ${hint}` : '';
}

/** Preserve original warning/throw/attribute order. @internal */
export function preserveDirectiveForRuntime(dir: DirectiveInfo, input: { session: CompileSession; varName: string; elementPath: string }): void {
  const { session, varName, elementPath } = input;
  const { options, warnings, runtimeDirectives, codeLines } = session;
  // BUG-COMP-08 FIX: غنی‌سازی پیام error با جزئیات بیشتر
  const valueDisplay = dir.value ? ` (value: "${dir.value}")` : '';
  const hint = getStrictHint(dir.name);
  const warning =
    `[Zenith Compiler] Directive '${dir.raw}'${valueDisplay} is not compilable` +
    ` and will be processed by runtime walker at ${elementPath}.${hint}`;
  warnings.push(warning);
  if (options.strict) {
    throw new Error(warning);
  }
  // در حالت غیر strict، warning را به stderr چاپ کن
  if (logger.isEnabled('warn')) {
    logger.warn(warning);
  }

  runtimeDirectives.push({
    directive: dir.raw,
    value: dir.value,
    elementPath,
  });

  // attribute اصلی را روی عنصر set کن تا runtime walker آن را ببیند
  codeLines.push(
    `  ${varName}.setAttribute(${JSON.stringify(dir.raw)}, ${JSON.stringify(dir.value)});`,
  );
  // علامت‌گذاری عنصر برای runtime walker
  codeLines.push(`  ${varName}.setAttribute('data-zenith-runtime', 'true');`);
}
