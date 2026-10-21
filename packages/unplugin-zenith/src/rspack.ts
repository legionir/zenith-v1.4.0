// packages/unplugin-zenith/src/rspack.ts — آداپتر Rspack زنیت (#164)
//
// لایهٔ نازک روی نمونهٔ یکتا (`./unplugin`): همان options، همان هوک‌ها.
// رفتار Vite-only (HMR/DevTools) این‌جا وجود ندارد؛ درخواست صریح آن‌ها با
// `ZEN-2520`/`ZEN-2521` رد می‌شود (نگاه کنید به `assertPortableOptions`).
import { zenithUnplugin } from './unplugin';

/**
 * پلاگین Rspack زنیت (هستهٔ مشترک؛ بدون HMR/DevTools).
 *
 * استفاده:
 *   // rspack.config.js
 *   import { zenithRspack } from '@zenith/unplugin-zenith/rspack';
 *   export default { plugins: [zenithRspack()] };
 *
 * @public
 */
export const zenithRspack = zenithUnplugin.rspack;

/** @public */
export default zenithRspack;
