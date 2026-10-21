// packages/unplugin-zenith/src/unplugin.ts — نمونهٔ یکتای unplugin روی پنج bundler (#164)
//
// یک factory، یک options، یک hook پیاده‌سازی‌شده (در `./shared`)؛ آداپترهای
// `./vite|rollup|webpack|esbuild|rspack` فقط همین نمونه را با همان options
// در قالب هر bundler عرضه می‌کنند. رفتار Vite-only (HMR، تزریق DevTools،
// `handleHotUpdate`) این‌جا نیست — در `./vite.ts` است و روی همین هسته سوار است.
//
// ESM-only (DEC-027 برای پکیج‌های born-ESM؛ انحراف از dual-tooling در DEC-027
// با استناد به DEC-034 در changeset ثبت شده): `unplugin@3` خودش ESM-only است.
import { createUnplugin } from 'unplugin';
import { assertPortableOptions, createCoreHooks, type ZenithUnpluginOptions } from './shared';

/**
 * نمونهٔ یکتای unplugin زنیت.
 *
 * گارد `assertPortableOptions` با `meta.framework` فعال می‌شود: وقتی همان
 * config روی bundler غیر-Vite اجرا شود، کلیدهای Vite-onlyِ صریح (`watchPatterns`
 * ناته، `autoInjectDevtools`، `enableHtmlHMR`) با کدهای کاتالوگ‌شده رد می‌شوند
 * (`ZEN-2520` bundler پشتیبانی‌نشده، `ZEN-2521` ناسازگاری HMR)؛ کلیدهای غایب
 * (پیش‌فرض‌ها) portable می‌مانند تا یک config همه‌جا build شود.
 *
 * @public
 */
export const zenithUnplugin = createUnplugin<ZenithUnpluginOptions | undefined, false>(
  (raw, meta) => {
    assertPortableOptions(raw, meta.framework);
    const { hooks } = createCoreHooks(raw);
    return {
      name: 'zenith-unplugin',
      enforce: 'pre',
      transformInclude: (id) => hooks.transformInclude(id),
      transform: (code, id) => hooks.transform(code, id),
      resolveId: (source) => hooks.resolveId(source),
      load: (id) => hooks.load(id),
      buildStart: () => hooks.buildStart(),
      buildEnd: () => hooks.buildEnd(),
    };
  },
);

/** @public */
export default zenithUnplugin;
