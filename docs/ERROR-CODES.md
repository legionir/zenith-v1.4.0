# کدهای خطای Zenith (ZEN-####)

> این فایل به‌صورت خودکار از `packages/errors/src/core.ts` تولید می‌شود (#102).
> برای تولید مجدد: `node scripts/generate-error-docs.mjs` (drift check: `--check`).
> صفحهٔ مستقل هر کد (علت، نمونهٔ خطا، رفع): [`docs/errors/`](./errors/README.md) — #112.

## انتخاب زبان پیام

```ts
import { setErrorLocale, getErrorMessage } from '@zenith/errors';
setErrorLocale('en'); // یا 'fa' (پیش‌فرض)
createReservedError('ZEN-1821'); // ← پیام به زبان انتخاب‌شده
```

## کدهای ۴رقمی (کاتالوگ رزورشده)

| کد | دامنه | دسته | پیام (FA) | Message (EN) | راه‌حل (suggestion) | مستندات |
|---|---|---|---|---|---|---|
| `ZEN-1001` | schema | Validation | گزینهٔ نامعتبر: نوع یا مقدار در مسیر مشخص‌شده انتظار schema را برآورده نمی‌کند. | Invalid option: type or value at the given path does not satisfy the schema. | مقدار را با نوع موردانتظار در schema تطبیق دهید؛ مسیر خطا در details آمده است. | [صفحه](./errors/ZEN-1001.md) |
| `ZEN-1002` | schema | Validation | کلید ناشناخته در گزینه‌ها. | Unknown key in options. | املای کلید را بررسی کنید؛ فهرست کلیدهای مجاز در details است. | [صفحه](./errors/ZEN-1002.md) |
| `ZEN-1003` | schema | Validation | JSON خراب در attribute. | Malformed JSON in attribute. | مقدار attribute باید JSON معتبر باشد (بدون کامای انتهایی و نقل‌قول تک). | [صفحه](./errors/ZEN-1003.md) |
| `ZEN-1004` | schema | Validation | مقدار خارج از بازهٔ مجاز. | Value out of allowed range. | مقدار را بین کمینه و بیشینهٔ اعلام‌شده در details قرار دهید. | [صفحه](./errors/ZEN-1004.md) |
| `ZEN-1090` | schema | Internal | آرگومان نامعتبر به تابع اعتبارسنجی گزینه‌ها. | Invalid argument to option validation function. | امضای تابع را از مستندات schema ببینید؛ آرگومان دوم باید schema معتبر باشد. | [صفحه](./errors/ZEN-1090.md) |
| `ZEN-1091` | schema | Internal | sink لاگر خراب است (خطا هنگام نوشتن گزارش). | Logger sink is broken (error while writing a log record). | sink را جایگزین یا remove کنید؛ خطا فقط یک‌بار گزارش می‌شود و حلقهٔ لاگ نمی‌سازد. | [صفحه](./errors/ZEN-1091.md) |
| `ZEN-1101` | storage | Runtime | ذخیره‌گاه در دسترس نیست (مثلاً حالت private مرورگر). | Storage unavailable (e.g. browser private mode). | fallback به memory فعال شد؛ در صورت نیاز به persist از ذخیره‌گاه جایگزین استفاده کنید. | [صفحه](./errors/ZEN-1101.md) |
| `ZEN-1102` | storage | Runtime | سهمیهٔ ذخیره‌گاه پر است (quota). | Storage quota exceeded. | کلیدهای قدیمی را پاک کنید یا از IndexedDB adapter استفاده کنید. | [صفحه](./errors/ZEN-1102.md) |
| `ZEN-1103` | storage | Runtime | مهاجرت (migrate) نسخهٔ داده شکست خورد. | Data migration failed. | تابع migrate را بررسی کنید؛ دادهٔ کهنه حذف یا نسخه‌بندی مجدد شود. | [صفحه](./errors/ZEN-1103.md) |
| `ZEN-1104` | storage | Runtime | دادهٔ ذخیره‌شده خراب/غیرقابل‌تجزیه است. | Stored data is corrupt/unparseable. | کلید آسیب‌دیده حذف می‌شود؛ منبع داده را بازسازی کنید. | [صفحه](./errors/ZEN-1104.md) |
| `ZEN-1201` | cache | Validation | ttl نامعتبر است. | Invalid ttl. | ttl باید عدد صحیح ≥ ۰ (میلی‌ثانیه) باشد؛ ۰ یعنی بدون انقضا. | [صفحه](./errors/ZEN-1201.md) |
| `ZEN-1202` | cache | Runtime | loader کش شکست خورد. | Cache loader failed. | خطای اصلی در cause است؛ retry یا fallback را بررسی کنید. | [صفحه](./errors/ZEN-1202.md) |
| `ZEN-1301` | i18n | Validation | تاریخ خارج از بازهٔ پشتیبانی‌شدهٔ تقویم جلالی است. | Date outside the supported Jalali calendar range. | بازهٔ مجاز ۱۲۰۱..۱۵۰۰ هجری شمسی است (DEC-020: به‌جای هشدار، throw). | [صفحه](./errors/ZEN-1301.md) |
| `ZEN-1302` | i18n | Validation | قالب تاریخ نامعتبر. | Invalid date format. | توکن‌های مجاز: YYYY YY MM M DD D MMM MMMM؛ ترکیب ناشناخته را حذف کنید. | [صفحه](./errors/ZEN-1302.md) |
| `ZEN-1303` | i18n | Validation | تاریخ نامعتبر (وجود ندارد). | Invalid date (does not exist). | روز/ماه را بررسی کنید (مثلاً ۱۵ اسفند ۳۰ روز نیست). | [صفحه](./errors/ZEN-1303.md) |
| `ZEN-1311` | i18n | Runtime | کلید پیام پیدا نشد. | Message key not found. | کلید را به bundle اضافه کنید یا missing策略 (throw/warn/empty) را تغییر دهید. | [صفحه](./errors/ZEN-1311.md) |
| `ZEN-1312` | i18n | Validation | قالب ICU نامعتبر است. | Invalid ICU format. | ساختار {plural, select, ...} را با مستندات i18n بسنجید. | [صفحه](./errors/ZEN-1312.md) |
| `ZEN-1313` | i18n | Validation | locale پشتیبانی‌نشده. | Unsupported locale. | locale را در فهرست fallback ثبت کنید یا bundle آن را بارگذاری کنید. | [صفحه](./errors/ZEN-1313.md) |
| `ZEN-1314` | i18n | Runtime | بارگذاری پیام‌ها شکست خورد. | Loading messages failed. | مسیر loader و شبکه را بررسی کنید؛ خطای اصلی در cause است. | [صفحه](./errors/ZEN-1314.md) |
| `ZEN-1401` | a11y | Runtime | المان focusable برای focus-trap پیدا نشد. | No focusable element found for focus-trap. | حداقل یک عنصر focusable داخل container بگذارید یا trap را غیرفعال کنید. | [صفحه](./errors/ZEN-1401.md) |
| `ZEN-1402` | a11y | Runtime | trap تودرتو با ترتیب پشتیبانی‌نشده. | Nested trap with unsupported order. | از پشتهٔ داخلی trap استفاده کنید؛ المان‌های trap را تودرتوی دستی نکنید. | [صفحه](./errors/ZEN-1402.md) |
| `ZEN-1403` | a11y | Validation | ویژگی aria-* با نقش المان ناسازگار است. | aria-* attribute incompatible with the element role. | ترکیب role/aria را با WAI-ARIA ARIA in HTML تطبیق دهید. | [صفحه](./errors/ZEN-1403.md) |
| `ZEN-1501` | head | Validation | تگ مجاز نیست. | Tag not allowed. | فهرست allowlist §head را ببینید؛ تگ‌های بدنه در head ممنوع‌اند. | [صفحه](./errors/ZEN-1501.md) |
| `ZEN-1502` | head | Validation | JSON-LD نامعتبر. | Invalid JSON-LD. | object را با JSON.stringify serializable کنید و schema.org را بررسی نمایید. | [صفحه](./errors/ZEN-1502.md) |
| `ZEN-1503` | head | Validation | تعداد تگ‌ها از maxTags بیشتر شد. | Tag count exceeded maxTags. | تگ‌ها را ادغام کنید یا maxTags را آگاهانه افزایش دهید. | [صفحه](./errors/ZEN-1503.md) |
| `ZEN-1601` | ui | Runtime | المان trigger پیدا نشد. | Trigger element not found. | selector trigger را اصلاح یا وقت render بودن آن را بررسی کنید. | [صفحه](./errors/ZEN-1601.md) |
| `ZEN-1602` | ui | Validation | zen-tab بدون zen-tabpanel متناظر. | zen-tab without a matching zen-tabpanel. | برای هر tab یک panel با aria-controls هم‌نام بگذارید. | [صفحه](./errors/ZEN-1602.md) |
| `ZEN-1603` | ui | Validation | مقدار value خارج از گزینه‌ها. | Value outside the options. | value باید یکی از مقادیر options باشد (یا placeholder مجاز است). | [صفحه](./errors/ZEN-1603.md) |
| `ZEN-1604` | ui | Runtime | portal مقصد ندارد. | Portal has no target. | target portal باید به المان موجود در DOM اشاره کند. | [صفحه](./errors/ZEN-1604.md) |
| `ZEN-1701` | realtime | Network | اتصال برقراری نشد. | Connection failed. | URL/شبکه را بررسی کنید؛ backoff خودکار در حال تلاش مجدد است. | [صفحه](./errors/ZEN-1701.md) |
| `ZEN-1702` | realtime | Network | پیام نامعتبر (parse شکست). | Invalid message (parse failed). | فرمت پیام (default: JSON) را با parser سرویس تطبیق دهید. | [صفحه](./errors/ZEN-1702.md) |
| `ZEN-1703` | realtime | Security | پروتکل ناامن: ws:// در صفحهٔ https. | Insecure protocol: ws:// on an https page. | از wss:// استفاده کنید (mixed-content). | [صفحه](./errors/ZEN-1703.md) |
| `ZEN-1704` | realtime | Runtime | صف ارسال پر است. | Send queue full. | نرخ ارسال را کم یا maxQueueSize را افزایش دهید؛ پیام‌های drop‌شده در details‌اند. | [صفحه](./errors/ZEN-1704.md) |
| `ZEN-1705` | realtime | Network | heartbeat timeout. | Heartbeat timeout. | heartbeatInterval سرویس و اتصال را بررسی کنید؛ reconnect خودکار آغاز می‌شود. | [صفحه](./errors/ZEN-1705.md) |
| `ZEN-1801` | adapters | Runtime | رندر SSR با timeout متوقف شد. | SSR render stopped by timeout. | renderTimeoutMs را افزایش یا داده‌های کندِ path را به suspense ببرید. | [صفحه](./errors/ZEN-1801.md) |
| `ZEN-1802` | adapters | Validation | template نامعتبر: نشانگر خروجی نیست. | Invalid template: no output marker. | <!--zen-outlet--> (یا کانفیگ marker) داخل template بگذارید. | [صفحه](./errors/ZEN-1802.md) |
| `ZEN-1803` | adapters | Runtime | AsyncLocalStorage در این runtime در دسترس نیست. | AsyncLocalStorage unavailable in this runtime. | context صریح (domImpl/ALS-free مسیر #92) را فعال کنید (DEC-022). | [صفحه](./errors/ZEN-1803.md) |
| `ZEN-1811` | adapters | Runtime | runtime پشتیبانی نمی‌شود. | Unsupported runtime. | Node ≥18.19، Cloudflare Workers یا Deno (DEC-027) را انتخاب کنید. | [صفحه](./errors/ZEN-1811.md) |
| `ZEN-1812` | adapters | Runtime | DOM implementation نصب نیست. | DOM implementation not installed. | linkedom یا happy-dom را به‌عنوان dependency نصب کنید (domImpl). | [صفحه](./errors/ZEN-1812.md) |
| `ZEN-1821` | adapters | Runtime | مسیر در SSG رندر نشد. | Route failed to render during SSG. | path در routes/paths پیکربندی وجود دارد و prerender سبز شد را بررسی کنید. | [صفحه](./errors/ZEN-1821.md) |
| `ZEN-1822` | adapters | Runtime | داده در زمان build در دسترس نیست. | Data unavailable at build time. | منبع داده را در build stage در دسترس کنید یا مسیر را CSR/ISR کنید. | [صفحه](./errors/ZEN-1822.md) |
| `ZEN-1901` | analytics | Runtime | ارائه‌دهندهٔ آنالیتیکس شکست خورد (خطا بلعیده نمی‌شود؛ جدا از برنامه گزارش شد). | Analytics provider failed (error not swallowed; reported separately). | provider را بررسی یا موقتاً غیرفعال کنید؛ دادهٔ رویداد و خطای اصلی برای حفظ حریم خصوصی گزارش نمی‌شوند. | [صفحه](./errors/ZEN-1901.md) |
| `ZEN-1902` | analytics | Security | رضایت کاربر لازم است. | User consent required. | قبل از track، consent manager را فعال کنید (GDPR). | [صفحه](./errors/ZEN-1902.md) |
| `ZEN-2001` | theme | Validation | token تم نامعتبر. | Invalid theme token. | نام token در تعریف theme وجود دارد و مقدار CSS-valid است. | [صفحه](./errors/ZEN-2001.md) |
| `ZEN-2002` | theme | Runtime | ذخیره‌گاه تم در دسترس نیست. | Theme storage unavailable. | storage تم را memory یا جایگزین قرار دهید. | [صفحه](./errors/ZEN-2002.md) |
| `ZEN-2101` | auth-oauth | Security | state مطابق نیست (احتمال CSRF). | state mismatch (possible CSRF). | flow را از همان مرورگر/تب ادامه دهید؛ state یک‌بارمصرف است (RFC 6749 §10.12). | [صفحه](./errors/ZEN-2101.md) |
| `ZEN-2102` | auth-oauth | Security | id_token نامعتبر. | Invalid id_token. | issuer/audience و امضا (JWKS) را بررسی کنید. | [صفحه](./errors/ZEN-2102.md) |
| `ZEN-2103` | auth-oauth | Network | discovery شکست خورد. | Discovery failed. | آدرس /.well-known/openid-configuration سرویس را بررسی کنید. | [صفحه](./errors/ZEN-2103.md) |
| `ZEN-2104` | auth-oauth | Security | refresh منقضی. | Refresh expired. | کاربر را مجدداً وارد کنید (re-auth)؛ refresh token را تمدید سیاست‌پذیر کنید. | [صفحه](./errors/ZEN-2104.md) |
| `ZEN-2105` | auth-oauth | Security | callback بدون code. | Callback without code. | response_type=code را در authorize بگذارید؛ error را از query parse کنید. | [صفحه](./errors/ZEN-2105.md) |
| `ZEN-2201` | feature-flags | Runtime | پرچم تعریف نشده (فقط dev). | Flag not defined (dev only). | flag را در registry ثبت کنید؛ در prod مقدار default مصرف می‌شود. | [صفحه](./errors/ZEN-2201.md) |
| `ZEN-2202` | feature-flags | Runtime | بارگذاری source پرچم‌ها شکست خورد. | Failed to load the flag source. | منبع (remote/file) و شبکه را بررسی کنید؛ fallback cached در کار است. | [صفحه](./errors/ZEN-2202.md) |
| `ZEN-2301` | runtime-core | Runtime | onMount/onUnmount/onUpdate خارج از محدودهٔ directive/کامپوننت. | onMount/onUnmount/onUpdate outside directive/component scope. | این قلاب‌ها فقط حین اجرای تابع directive یا setup کامپوننت مجازند. | [صفحه](./errors/ZEN-2301.md) |
| `ZEN-2302` | runtime-core | Validation | تعارض directive ساختاری روی یک المان. | Conflicting structural directives on one element. | zen-if و zen-for (و همتایان else) را روی المان‌های جدا بگذارید (SPEC §۲.۸ priority). | [صفحه](./errors/ZEN-2302.md) |
| `ZEN-2303` | runtime-core | Validation | zen-for بدون zen-key. | zen-for without zen-key. | zen-key یکتا و پایدار برای هر آیتم بگذارید (همان ZEN-101؛ برای API جدید core). | [صفحه](./errors/ZEN-2303.md) |
| `ZEN-2310` | runtime-core | Runtime | عدم تطابق hydration. | Hydration mismatch. | در dev diff چاپ می‌شود؛ در prod بازرندر موضعی انجام می‌گیرد. خروجی SSR/client را یکسان کنید. | [صفحه](./errors/ZEN-2310.md) |
| `ZEN-2320` | runtime-core | Runtime | نسخهٔ پکیج‌ها lockstep نیست (assertCompatible). | Package versions not in lockstep (assertCompatible). | همهٔ @zenith/* را به یک نسخه (DEC-026) برسانید؛ نسخه‌های مشاهده‌شده در details است. | [صفحه](./errors/ZEN-2320.md) |
| `ZEN-2401` | devtools-core | Runtime | نسخهٔ hook ناسازگار. | Incompatible hook version. | devtools و runtime را هم‌نسخه کنید (lockstep، DEC-026). | [صفحه](./errors/ZEN-2401.md) |
| `ZEN-2402` | devtools-core | Runtime | snapshot نامعتبر. | Invalid snapshot. | ساختار snapshot §devtools-core را رعایت کنید؛ فیلدهای اجباری را بفرستید. | [صفحه](./errors/ZEN-2402.md) |
| `ZEN-2501` | tooling | Validation | نام پروژه نامعتبر. | Invalid project name. | فقط [a-z0-9-_.]؛ بدون ..، مسیر مطلق یا جداکننده (create-zenith §۳.۹). | [صفحه](./errors/ZEN-2501.md) |
| `ZEN-2510` | tooling | Runtime | متادیتا (zenith.meta.json) بارگذاری نشد. | Metadata (zenith.meta.json) failed to load. | build با meta:true اجرا شده و مسیر فایل درست است؟ | [صفحه](./errors/ZEN-2510.md) |
| `ZEN-2520` | tooling | Runtime | پلاگین روی این bundler پشتیبانی نمی‌شود. | Plugin not supported on this bundler. | unplugin فقط rollup/vite/webpack/rspack را پشتیبانی می‌کند (SPEC §۴.۴). | [صفحه](./errors/ZEN-2520.md) |
| `ZEN-2521` | tooling | Runtime | HMR ناسازگار. | Incompatible HMR. | نسخهٔ bundler/پلاگین را تطبیق یا HMR را غیرفعال کنید. | [صفحه](./errors/ZEN-2521.md) |
| `ZEN-2530` | tooling | Runtime | درخواست بدون handler (mock). | Request without handler (mock). | handler متناظر ثبت یا onUnhandledRequest را bypass کنید؛ مسیر/متد در details است. | [صفحه](./errors/ZEN-2530.md) |
| `ZEN-2531` | tooling | Runtime | handler دوبار پاسخ داد (mock). | Handler responded twice (mock). | هر resolver فقط یک respond() صدا بزند (passthrough با respond ترکیب نشود). | [صفحه](./errors/ZEN-2531.md) |
| `ZEN-9001` | cli | Internal | خواندن فایل ممکن نیست (check). | Unable to read file (check). | مجوز/مسیر فایل را بررسی کنید (جایگزین Z001 قدیمی). | [صفحه](./errors/ZEN-9001.md) |
| `ZEN-9010` | cli | Security | compileAndRender حذف‌شده (نام‌امن) استفاده شده است. | Removed compileAndRender is used (unsafe). | از zen-text یا zen-html با عبارت پیش‌کتبهٔ امن استفاده کنید (جایگزین Z100 قدیمی). | [صفحه](./errors/ZEN-9010.md) |
| `ZEN-9011` | cli | Security | استفاده از eval() یا new Function() در <script>. | Use of eval() or new Function() in <script>. | الگوی eval برای امنیت (XSS) در Zenith ممنوع است (جایگزین Z101 قدیمی). | [صفحه](./errors/ZEN-9011.md) |
| `ZEN-9020` | cli | Compiler | directive منسوخ‌شده. | Deprecated directive. | جایگزین رسمی را طبق جدول DEPRECATED_DIRECTIVES به‌کار ببرید (جایگزین Z200 قدیمی). | [صفحه](./errors/ZEN-9020.md) |
| `ZEN-9021` | cli | Compiler | directive ناشناخته. | Unknown directive. | املای zen-* را با فهرست directiveهای معتبر بسنجید (جایگزین Z201 قدیمی). | [صفحه](./errors/ZEN-9021.md) |
| `ZEN-9030` | cli | Runtime | zen-for بدون zen-key. | zen-for without zen-key. | zen-key یکتا برای هر آیتم اضافه کنید (DOM thrashing/state loss؛ جایگزین Z300 قدیمی). | [صفحه](./errors/ZEN-9030.md) |
| `ZEN-9031` | cli | Compiler | zen-text با عبارت خالی. | zen-text with an empty expression. | عبارت معتبر بدهید یا directive را حذف کنید (جایگزین Z301 قدیمی). | [صفحه](./errors/ZEN-9031.md) |
| `ZEN-9032` | cli | Compiler | zen-if با عبارت خالی. | zen-if with an empty expression. | عبارت شرطی معتبر بدهید (جایگزین Z302 قدیمی). | [صفحه](./errors/ZEN-9032.md) |
| `ZEN-9040` | cli | Security | zen-html با متغیر قابل‌تزریق احتمالی. | zen-html with a probably injectable variable. | ورودی را sanitizeHTML کنید یا allowlist پیش‌فرض را حفظ کنید (جایگزین Z400 قدیمی). | [صفحه](./errors/ZEN-9040.md) |
| `ZEN-9050` | cli | Security | الگوی دایرکتوری‌تراورسال در مسیر. | Directory traversal pattern in path. | مسیر را به ریشهٔ پروژه محدود کنید (جایگزین Z500 قدیمی). | [صفحه](./errors/ZEN-9050.md) |
| `ZEN-9060` | cli | Security | secret احتمالی در کد. | Potential secret in code. | کلید/توکن را به env منتقل کنید (جایگزین Z600 قدیمی). | [صفحه](./errors/ZEN-9060.md) |
| `ZEN-9061` | cli | Security | referrer ضعیف در head. | Weak referrer policy in head. | referrerpolicy را no-referrer یا strict-origin-when-cross-origin کنید (جایگزین Z601 قدیمی). | [صفحه](./errors/ZEN-9061.md) |
| `ZEN-9070` | cli | Network | fetch با scheme ناامن (http). | fetch with an insecure scheme (http). | https استفاده کنید یا الگوی URL را بازبینی کنید (جایگزین Z700 قدیمی). | [صفحه](./errors/ZEN-9070.md) |
| `ZEN-9080` | cli | Security | attribute رویدادی (on*) در template. | Event attribute (on*) in template. | از zen-click/zen-action (event delegation امن) استفاده کنید (جایگزین Z800 قدیمی). | [صفحه](./errors/ZEN-9080.md) |
| `ZEN-9081` | cli | Security | iframe بدون sandbox. | iframe without sandbox. | sandbox محدودکننده برای iframe بگذارید (جایگزین Z810 قدیمی). | [صفحه](./errors/ZEN-9081.md) |
| `ZEN-9082` | cli | Security | link خارجی بدون rel=noopener. | External link without rel=noopener. | rel="noopener noreferrer" به target=_blank اضافه کنید (جایگزین Z820 قدیمی). | [صفحه](./errors/ZEN-9082.md) |

## کدهای ۳رقمی (کلاسیک — renumber نمی‌شوند)

| کد | دسته | توضیح (EN) | مستندات |
|---|---|---|---|
| `ZEN-001` | Expression | Variable is not defined in the context. | [صفحه](./errors/ZEN-001.md) |
| `ZEN-002` | Expression | Access to a forbidden property in the expression (security). | [صفحه](./errors/ZEN-002.md) |
| `ZEN-003` | Expression | Forbidden identifier in the expression (security). | [صفحه](./errors/ZEN-003.md) |
| `ZEN-004` | Expression | Expression syntax error. | [صفحه](./errors/ZEN-004.md) |
| `ZEN-005` | Expression | The expression is not a function. | [صفحه](./errors/ZEN-005.md) |
| `ZEN-006` | Expression | Unknown operator in the expression. | [صفحه](./errors/ZEN-006.md) |
| `ZEN-007` | Expression | Unknown node type in the expression AST. | [صفحه](./errors/ZEN-007.md) |
| `ZEN-101` | Runtime | zen-for requires zen-key. | [صفحه](./errors/ZEN-101.md) |
| `ZEN-102` | Runtime | Invalid zen-for syntax. | [صفحه](./errors/ZEN-102.md) |
| `ZEN-103` | Runtime | zen-for element has no parent. | [صفحه](./errors/ZEN-103.md) |
| `ZEN-104` | Runtime | zen-if element has no parent. | [صفحه](./errors/ZEN-104.md) |
| `ZEN-105` | Runtime | Directive expression evaluation failed. | [صفحه](./errors/ZEN-105.md) |
| `ZEN-106` | Runtime | Component not found in the registry. | [صفحه](./errors/ZEN-106.md) |
| `ZEN-107` | Runtime | Component dispose failed. | [صفحه](./errors/ZEN-107.md) |
| `ZEN-201` | Resource | Resource has been destroyed. | [صفحه](./errors/ZEN-201.md) |
| `ZEN-202` | Resource | HTTP error while fetching the resource. | [صفحه](./errors/ZEN-202.md) |
| `ZEN-203` | Resource | Resource URL evaluation failed. | [صفحه](./errors/ZEN-203.md) |
| `ZEN-204` | Resource | Resource signal not found. | [صفحه](./errors/ZEN-204.md) |
| `ZEN-205` | Resource | Resource mutation failed. | [صفحه](./errors/ZEN-205.md) |
| `ZEN-301` | SSR | SSR requires a DOM implementation (JSDOM-compatible). | [صفحه](./errors/ZEN-301.md) |
| `ZEN-302` | SSR | Root element not found for SSR. | [صفحه](./errors/ZEN-302.md) |
| `ZEN-303` | SSR | AsyncLocalStorage unavailable for SSR isolation. | [صفحه](./errors/ZEN-303.md) |
| `ZEN-304` | SSR | Hydration mismatch between server and client markup. | [صفحه](./errors/ZEN-304.md) |
| `ZEN-401` | Security | XSS blocked: untrusted markup neutralized. | [صفحه](./errors/ZEN-401.md) |
| `ZEN-402` | Security | Sanitization failed: input rejected. | [صفحه](./errors/ZEN-402.md) |
| `ZEN-403` | Security | Secure random source unavailable. | [صفحه](./errors/ZEN-403.md) |
| `ZEN-404` | Security | Insecure token storage detected. | [صفحه](./errors/ZEN-404.md) |
| `ZEN-501` | Compiler | Unknown directive at compile time. | [صفحه](./errors/ZEN-501.md) |
| `ZEN-502` | Compiler | Compile-time expression error. | [صفحه](./errors/ZEN-502.md) |
| `ZEN-503` | Compiler | Compile-time syntax error. | [صفحه](./errors/ZEN-503.md) |
| `ZEN-504` | Compiler | Missing import at compile time. | [صفحه](./errors/ZEN-504.md) |
| `ZEN-551` | Compiler | Sandbox (VM) runtime error. | [صفحه](./errors/ZEN-551.md) |
| `ZEN-552` | Compiler | Sandbox timeout. | [صفحه](./errors/ZEN-552.md) |
| `ZEN-553` | Compiler | Sandbox memory limit exceeded. | [صفحه](./errors/ZEN-553.md) |
| `ZEN-601` | Router | Route not found. | [صفحه](./errors/ZEN-601.md) |
| `ZEN-602` | Router | Lazy route loading failed. | [صفحه](./errors/ZEN-602.md) |
| `ZEN-603` | Router | Navigation aborted by a guard. | [صفحه](./errors/ZEN-603.md) |
| `ZEN-701` | Form / Validation | Form validation failed. | [صفحه](./errors/ZEN-701.md) |
| `ZEN-702` | Form / Validation | Form schema invalid. | [صفحه](./errors/ZEN-702.md) |
| `ZEN-801` | Component | Slot not found. | [صفحه](./errors/ZEN-801.md) |
| `ZEN-802` | Component | Required prop missing. | [صفحه](./errors/ZEN-802.md) |
| `ZEN-901` | Internal | Unknown internal error. | [صفحه](./errors/ZEN-901.md) |
| `ZEN-905` | Internal | Internal runtime failure. | [صفحه](./errors/ZEN-905.md) |
| `ZEN-906` | Internal | Internal reactivity failure. | [صفحه](./errors/ZEN-906.md) |
| `ZEN-907` | Internal | Developer precondition violated (assert). | [صفحه](./errors/ZEN-907.md) |
| `ZEN-908` | Internal | Internal hydration mismatch. | [صفحه](./errors/ZEN-908.md) |

## کدهای deprecation (ZEN-DEPR-###)

| کد | API قدیمی | جایگزین | حذف در | مستندات |
|---|---|---|---|---|
| `ZEN-DEPR-001` | `processVirtualList` | `createVirtualList` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-001.md) |
| `ZEN-DEPR-002` | `enterTransition` | `createTransition(name).enter(el)` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-002.md) |
| `ZEN-DEPR-003` | `leaveTransition` | `createTransition(name).leave(el)` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-003.md) |
| `ZEN-DEPR-004` | `animateGroup` | `createTransition(name) shared controller` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-004.md) |
| `ZEN-DEPR-005` | `clearCache (http)` | `clearHttpCache` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-005.md) |
| `ZEN-DEPR-006` | `toJalali (i18n)` | `@zenith/jalali toJalaliParts/formatJalali` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-006.md) |
| `ZEN-DEPR-007` | `fromJalali (i18n)` | `@zenith/jalali fromJalaliParts` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-007.md) |
| `ZEN-DEPR-008` | `parseJalaliParts (i18n)` | `@zenith/jalali toJalaliParts` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-008.md) |
| `ZEN-DEPR-009` | `formatJalali (i18n)` | `@zenith/jalali formatJalali` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-009.md) |
| `ZEN-DEPR-010` | `jalaliNow (i18n)` | `@zenith/jalali jalaliNow` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-010.md) |
| `ZEN-DEPR-011` | `jalaliMonthDays (i18n)` | `@zenith/jalali monthDays` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-011.md) |
| `ZEN-DEPR-012` | `jalaliMonthName (i18n)` | `@zenith/jalali monthName` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-012.md) |
| `ZEN-DEPR-013` | `isJalaliLeap (i18n)` | `@zenith/jalali isLeap` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-013.md) |
| `ZEN-DEPR-014` | `compareJalali (i18n)` | `@zenith/jalali compareJalali` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-014.md) |
| `ZEN-DEPR-015` | `addDaysJalali (i18n)` | `@zenith/jalali addDays` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-015.md) |
| `ZEN-DEPR-016` | `fromZod (form)` | `@zenith/schema/zod fromZod` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-016.md) |
| `ZEN-DEPR-017` | `validateWithZod (form)` | `@zenith/schema/zod validateWithZod` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-017.md) |
| `ZEN-DEPR-018` | `fromJsonSchema (form)` | `@zenith/schema/json-schema fromJsonSchema` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-018.md) |
| `ZEN-DEPR-019` | `ActionRegistry.destroy()` | `ActionRegistry.dispose()` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-019.md) |
| `ZEN-DEPR-020` | `Auth.destroy()` | `Auth.dispose()` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-020.md) |
| `ZEN-DEPR-021` | `CrudEngine.destroy()` | `CrudEngine.dispose()` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-021.md) |
| `ZEN-DEPR-022` | `FormStore.destroy()` | `FormStore.dispose()` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-022.md) |
| `ZEN-DEPR-023` | `Resource.destroy()` | `Resource.dispose()` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-023.md) |
| `ZEN-DEPR-024` | `SWController.destroy()` | `SWController.dispose()` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-024.md) |
| `ZEN-DEPR-025` | `schedule() (@zenith/scheduler)` | `scheduleEffect()` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-025.md) |
| `ZEN-DEPR-026` | `installStatefulComponents()` | `Zen.use(ZenithStatefulPlugin)` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-026.md) |
| `ZEN-DEPR-027` | `registerSignal (@zenith/state)` | `@zenith/devtools-core registerSignal / installDevtoolsCore` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-027.md) |
| `ZEN-DEPR-028` | `recordStateChange (@zenith/state)` | `@zenith/devtools-core recordStateChange / installDevtoolsCore` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-028.md) |
| `ZEN-DEPR-029` | `getAllSignals (@zenith/state)` | `@zenith/devtools-core getAllSignals` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-029.md) |
| `ZEN-DEPR-030` | `getSignalInfo (@zenith/state)` | `@zenith/devtools-core getSignalInfo` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-030.md) |
| `ZEN-DEPR-031` | `getStateTimeline (@zenith/state)` | `@zenith/devtools-core getTimeline` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-031.md) |
| `ZEN-DEPR-032` | `onStateChange (@zenith/state)` | `@zenith/devtools-core onStateChange` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-032.md) |
| `ZEN-DEPR-033` | `nameSignal (@zenith/state)` | `@zenith/devtools-core nameSignal` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-033.md) |
| `ZEN-DEPR-034` | `clearRegistry (@zenith/state)` | `@zenith/devtools-core clearRegistry` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-034.md) |
| `ZEN-DEPR-035` | `createMutation(fn, options)` | `createMutation({ fn, ...options })` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-035.md) |
| `ZEN-DEPR-036` | `createInfiniteQuery(key, fn, options)` | `createInfiniteQuery({ key, fn, ...options })` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-036.md) |
| `ZEN-DEPR-037` | `trackPromise(promise, suspense, key, timeout)` | `trackPromise(promise, { suspense, key, timeout })` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-037.md) |
| `ZEN-DEPR-038` | `withTimeout(promise, ms, message)` | `withTimeout(promise, { ms, message })` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-038.md) |
| `ZEN-DEPR-039` | `animate(el, keyframes, duration, easing, delay, fill, onFinish)` | `animate(el, { keyframes, duration, easing, delay, fill, onFinish })` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-039.md) |
| `ZEN-DEPR-040` | `animateEnter(el, name, duration, easing, onFinish)` | `animateEnter(el, { name, duration, easing, onFinish })` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-040.md) |
| `ZEN-DEPR-041` | `animateLeave(el, name, duration, easing, onFinish)` | `animateLeave(el, { name, duration, easing, onFinish })` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-041.md) |
| `ZEN-DEPR-042` | `registerCache (@zenith/devtools-core)` | `registerDevtoolsCache` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-042.md) |
| `ZEN-DEPR-043` | `registerStore (@zenith/devtools-core)` | `registerDevtoolsStore` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-043.md) |
| `ZEN-DEPR-044` | `registerSignal (@zenith/devtools)` | `registerPanelSignal` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-044.md) |
| `ZEN-DEPR-045` | `recordStateChange (@zenith/devtools)` | `recordPanelStateChange` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-045.md) |
| `ZEN-DEPR-046` | `invalidate (@zenith/data)` | `invalidateFetchCache` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-046.md) |
| `ZEN-DEPR-049` | `validate (@zenith/expressions)` | `validateAst` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-049.md) |
| `ZEN-DEPR-050` | `deprecate (@zenith/logger)` | `warnDeprecated` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-050.md) |
| `ZEN-DEPR-051` | `mockHttp (@zenith/testing)` | `mockFetch` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-051.md) |
| `ZEN-DEPR-052` | `alert (@zenith/notifications)` | `showAlert` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-052.md) |
| `ZEN-DEPR-053` | `confirm (@zenith/notifications)` | `showConfirm` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-053.md) |
| `ZEN-DEPR-054` | `clearActions` | `resetForTesting() (@zenith/testing)` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-054.md) |
| `ZEN-DEPR-055` | `clearComponents` | `resetForTesting() (@zenith/testing)` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-055.md) |
| `ZEN-DEPR-056` | `clearAuth` | `resetForTesting() (@zenith/testing)` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-056.md) |
| `ZEN-DEPR-057` | `clearPermissionManagers` | `resetForTesting() (@zenith/testing)` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-057.md) |
| `ZEN-DEPR-058` | `clearResources` | `resetForTesting() (@zenith/testing)` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-058.md) |
| `ZEN-DEPR-059` | `clearStores` | `resetForTesting() (@zenith/testing)` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-059.md) |
| `ZEN-DEPR-060` | `clearServerComponents` | `resetForTesting() (@zenith/testing)` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-060.md) |
| `ZEN-DEPR-061` | `clearEventModifiers` | `resetForTesting() (@zenith/testing)` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-061.md) |
| `ZEN-DEPR-062` | `clearCustomDirectives` | `resetForTesting() (@zenith/testing)` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-062.md) |
| `ZEN-DEPR-063` | `clearScheduler` | `resetForTesting() (@zenith/testing)` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-063.md) |
| `ZEN-DEPR-064` | `clearRegistry (@zenith/devtools-core)` | `resetForTesting() (@zenith/testing)` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-064.md) |
| `ZEN-DEPR-065` | `createSuspenseContext(timeoutMs, onSettle)` | `createSuspenseContext({ timeoutMs, onSettle })` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-065.md) |
| `ZEN-DEPR-066` | `processFetchWithCache(url, ttl)` | `processFetchWithCache(url, { ttl })` | 2.0.0 | [صفحه](./errors/ZEN-DEPR-066.md) |

## قوانین `zenith check` (CLI)

قوانین امنیت/کیفیت `zenith check` در بازهٔ `ZEN-9000..9899` هستند (جایگزین شناسه‌های قدیمی Z001..Z820 در #102).

---

لینک آنلاین هر کد: `https://zenith.dev/errors/<code>` (همان `docsUrl` روی `ZenithError`).
