# مثال‌های مستندات با راستی‌آزمایی CI (`#106`)

مثال‌های این مخزن کهنه نمی‌شوند: هر بلوک کدی که با علامت **`test`** مشخص شده
باشد، در CI کامپایل (و در صورت لزوم اجرا) می‌شود. تغییر API که مثالی را بشکند،
job را قرمز می‌کند.

## علامت‌گذاری

| Markdown | معنی | CI چه می‌کند |
|---|---|---|
| ```` ```ts test ```` | مثال TypeScript | با `tsc --noEmit` و resolve مستقیم به `packages/*/src` کامپایل می‌شود |
| ```` ```ts test-run ```` | مثال بدون DOM | کامپایل + **اجرا** در Node (vitest) |
| ```` ```ts test-dom ```` | مثال وابسته به DOM | کامپایل + **اجرا** با jsdom (vitest) |
| ```` ```html test ```` | قطعهٔ HTML | بررسی می‌شود خالی/بی‌تگ نباشد |

```ts test
// این بلوک خودش نمونه است: اگر API عوض شود، CI قرمز می‌شود.
import { signal, computed } from '@zenith/state';

const count = signal(1);
const double = computed(() => count.get() * 2);
count.set(2);
export const result = double.get(); // 4
```

قواعد:

1. هر بلوک علامت‌خورده باید **مستقل** باشد (importها و متغیرهای خودش را داشته
   باشد)؛ بلوک‌ها جداگانه کامپایل می‌شوند و به بلوک قبلی تکیه نمی‌کنند.
2. در مثال‌های `test-run` فقط از APIهای بدون DOM استفاده کنید؛ برای مثال‌های
   وابسته به `document` علامت `test-dom` بگذارید.
3. مثال باید بدون شبکه/زمان واقعی اجرا شود (deterministic).

## اجرای محلی

```bash
npm run check:docs-examples      # گیت کامپایل (همان چیزی که CI اجرا می‌کند)
npm test -- docs-examples        # اجرای مثال‌های test-run / test-dom
```

خروجی گیت، مثال‌های شکسته را با آدرس «فایل:خط» گزارش می‌کند:

```
❌ docs/COOKBOOK.md#L127
.docexamples/docs_COOKBOOK_md_L127.ts(4,10): error TS2305: Module '"@zenith/crud"' has no exported member 'createCrud'.
```

## پیاده‌سازی

| فایل | نقش |
|---|---|
| `scripts/lib/docs-examples.mjs` | استخراج بلوک‌های علامت‌خورده از `README.md`، `docs/**` و `packages/*/README.md` |
| `scripts/check-docs-examples.mjs` | تولید پروژهٔ موقت `.docexamples/` و اجرای `tsc --noEmit`؛ گیت CI (`npm run check:docs-examples` در job `deps`) |
| `scripts/test/docs-examples.test.mjs` | گیت کامپایل + اجرای `test-run` + پروب منفی |
| `scripts/test/docs-examples-dom.test.mjs` | اجرای `test-dom` با jsdom |

> پوشهٔ `.docexamples/` فقط موقت است (در `.gitignore`/`.prettierignore`) و در
> پایان هر اجرا پاک می‌شود.
