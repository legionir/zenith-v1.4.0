// packages/service-worker/src/sw-plugin.ts
//
// پلاگین Zenith برای نصب SW — استخراج مکانیکی از index.ts،
// بدون تغییر رفتار (#40).

import type { SWConfig, ZenLikeForSW, ZenithPluginStructural } from './sw-types';
import { swConfigOptions } from './sw-options';
import { registerSW } from './sw-register';


/**
 * FEATURE (v0.4.0): پلاگین Zenith برای نصب SW.
 *
 * استفاده:
 *   import { Zen } from '@zenith/runtime';
 *   import { zenithSWPlugin } from '@zenith/service-worker';
 *   Zen.use(zenithSWPlugin, {
 *     swUrl: '/sw.js',
 *     precache: ['/'],
 *     routes: [ { urlPattern: '/api', strategy: 'networkFirst' } ],
 *   });
 *
 * `install` یک Controller برمی‌دارد و روی `Zen` به‌عنوان `Zen.sw` قرار می‌دهد.
 * علاوه بر این، در محیط‌های غیر مرورگری no-op است.
 *
 * @public
 */
export const zenithSWPlugin: ZenithPluginStructural = {
  name: 'zenith-service-worker',
  install: (zen: ZenLikeForSW, options?: unknown): void => {
    // #52 — اعتبارسنجی SWConfig در مرز ورودی پلاگین
    const config: SWConfig = swConfigOptions.resolve(options);

    // ثبت SW و قرار دادن controller روی Zen.
    const controller = registerSW(config.swUrl || '/sw.js', {
      scope: config.scope,
    });

    // SECURITY (v0.5.0): اگر registerSW در SSR بود و undefined برگرداند،
    // plugin به‌صورت no-op عمل می‌کند تا crash رخ ندهد.
    if (!controller) {
      return;
    }

    // FEATURE (v0.4.0): افزودن helper ها روی Zen (اختیاری).
    // کاربر می‌تواند با `Zen.sw.update()` یا `Zen.sw.unregister()` کار کند.
    zen.sw = controller;

    // در dev mode، یک action 'swUpdate' ثبت می‌کنیم تا کاربر بتواند از HTML
    // با zen-action="swUpdate" آپدیت را صدا بزند.
    if (zen && typeof zen.action === 'function') {
      zen.action('swUpdate', async () => {
        await controller.update();
      });
      zen.action('swUnregister', async () => {
        await controller.unregister();
      });
    }
  },
};
