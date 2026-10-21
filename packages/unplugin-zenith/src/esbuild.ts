// packages/unplugin-zenith/src/esbuild.ts — آداپتر esbuild زنیت (#164)
//
// لایهٔ نازک روی نمونهٔ یکتا (`./unplugin`): همان options، همان هوک‌ها.
// رفتار Vite-only (HMR/DevTools) این‌جا وجود ندارد؛ درخواست صریح آن‌ها با
// `ZEN-2520`/`ZEN-2521` رد می‌شود (نگاه کنید به `assertPortableOptions`).
import { zenithUnplugin } from './unplugin';

/**
 * پلاگین esbuild زنیت (هستهٔ مشترک؛ بدون HMR/DevTools).
 *
 * استفاده:
 *   // build.mjs
 *   import { zenithEsbuild } from '@zenith/unplugin-zenith/esbuild';
 *   await esbuild.build({ plugins: [zenithEsbuild()] });
 *
 * @public
 */
export const zenithEsbuild = zenithUnplugin.esbuild;

/** @public */
export default zenithEsbuild;
