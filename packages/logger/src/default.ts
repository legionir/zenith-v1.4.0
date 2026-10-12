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
