import { setHostPrinter } from '@zenith/errors/internal';
import type { Cleanup } from '@zenith/shared';
import type { Logger } from './types';
// packages/logger/src/default.ts
//
// #143 — نمونهٔ پیش‌فرض (SPEC §۲.۳: `logger` با scope `zen`).
//
// عمداً در فایل جداست: deprecate.ts این نمونه را import می‌کند و index.ts
// آن را re-export؛ به این ترتیب هیچ import دوطرفه‌ای ساخته نمی‌شود.
import { createLogger } from './logger';
import type { FullLogger } from './types';

/** لاگر پیش‌فرض با scope `zen`؛ سطح/sinkهای پیش‌فرض از SPEC §۲.۳. */
export const logger: FullLogger = createLogger();

/**
 * Install the diagnostic bridge explicitly. It is not an import-time effect:
 * primitive-only consumers must not retain the default logger/console sink.
 * Standalone errors can use this or setErrorLogger for an explicit host policy.
 */
export function installDiagnosticLogger(next: Logger = logger): Cleanup {
  return setHostPrinter((severity, title, payload) => {
    const details = payload && typeof payload === 'object' ? payload as Record<string, unknown> : undefined;
    if (severity === 'warning') next.warn(title, details);
    else if (severity === 'error') next.error(title, details);
    else next.info(title, details);
  });
}
