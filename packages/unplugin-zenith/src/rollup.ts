// packages/unplugin-zenith/src/rollup.ts — آداپتر Rollup زنیت (#164)
//
// لایهٔ نازک روی نمونهٔ یکتا (`./unplugin`): همان options، همان هوک‌ها.
// رفتار Vite-only (HMR/DevTools) این‌جا وجود ندارد؛ درخواست صریح آن‌ها با
// `ZEN-2520`/`ZEN-2521` رد می‌شود (نگاه کنید به `assertPortableOptions`).
import { zenithUnplugin } from './unplugin';

/**
 * پلاگین Rollup زنیت (هستهٔ مشترک؛ بدون HMR/DevTools).
 *
 * استفاده:
 *   // rollup.config.js
 *   import { zenithRollup } from '@zenith/unplugin-zenith/rollup';
 *   export default { plugins: [zenithRollup()] };
 *
 * @public
 */
export const zenithRollup = zenithUnplugin.rollup;

/** @public */
export default zenithRollup;
