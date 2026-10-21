// packages/unplugin-zenith/src/webpack.ts — آداپتر Webpack زنیت (#164)
//
// لایهٔ نازک روی نمونهٔ یکتا (`./unplugin`): همان options، همان هوک‌ها.
// رفتار Vite-only (HMR/DevTools) این‌جا وجود ندارد؛ درخواست صریح آن‌ها با
// `ZEN-2520`/`ZEN-2521` رد می‌شود (نگاه کنید به `assertPortableOptions`).
import { zenithUnplugin } from './unplugin';

/**
 * پلاگین Webpack زنیت (هستهٔ مشترک؛ بدون HMR/DevTools).
 *
 * استفاده:
 *   // webpack.config.js
 *   import { zenithWebpack } from '@zenith/unplugin-zenith/webpack';
 *   export default { plugins: [zenithWebpack()] };
 *
 * @public
 */
export const zenithWebpack = zenithUnplugin.webpack;

/** @public */
export default zenithWebpack;
