# کدهای خطای Zenith (ZEN-####)

> این فایل به‌صورت خودکار از `packages/errors/src/core.ts` تولید می‌شود (#102).
> برای تولید مجدد: `node scripts/generate-error-docs.mjs` (drift check: `--check`).

## انتخاب زبان پیام

```ts
import { setErrorLocale, getErrorMessage } from '@zenith/errors';
setErrorLocale('en'); // یا 'fa' (پیش‌فرض)
createReservedError('ZEN-1821'); // ← پیام به زبان انتخاب‌شده
```

## کدهای ۴رقمی (کاتالوگ رزورشده)

| کد | دامنه | دسته | پیام (FA) | Message (EN) | راه‌حل (suggestion) |
|---|---|---|---|---|---|
| `ZEN-1001` | schema | Validation | گزینهٔ نامعتبر: نوع یا مقدار در مسیر مشخص‌شده انتظار schema را برآورده نمی‌کند. | Invalid option: type or value at the given path does not satisfy the schema. | مقدار را با نوع موردانتظار در schema تطبیق دهید؛ مسیر خطا در details آمده است. |
| `ZEN-1002` | schema | Validation | کلید ناشناخته در گزینه‌ها. | Unknown key in options. | املای کلید را بررسی کنید؛ فهرست کلیدهای مجاز در details است. |
| `ZEN-1003` | schema | Validation | JSON خراب در attribute. | Malformed JSON in attribute. | مقدار attribute باید JSON معتبر باشد (بدون کامای انتهایی و نقل‌قول تک). |
| `ZEN-1004` | schema | Validation | مقدار خارج از بازهٔ مجاز. | Value out of allowed range. | مقدار را بین کمینه و بیشینهٔ اعلام‌شده در details قرار دهید. |
| `ZEN-1090` | schema | Internal | آرگومان نامعتبر به تابع اعتبارسنجی گزینه‌ها. | Invalid argument to option validation function. | امضای تابع را از مستندات schema ببینید؛ آرگومان دوم باید schema معتبر باشد. |
| `ZEN-1091` | schema | Internal | sink لاگر خراب است (خطا هنگام نوشتن گزارش). | Logger sink is broken (error while writing a log record). | sink را جایگزین یا remove کنید؛ خطا فقط یک‌بار گزارش می‌شود و حلقهٔ لاگ نمی‌سازد. |
| `ZEN-1101` | storage | Runtime | ذخیره‌گاه در دسترس نیست (مثلاً حالت private مرورگر). | Storage unavailable (e.g. browser private mode). | fallback به memory فعال شد؛ در صورت نیاز به persist از ذخیره‌گاه جایگزین استفاده کنید. |
| `ZEN-1102` | storage | Runtime | سهمیهٔ ذخیره‌گاه پر است (quota). | Storage quota exceeded. | کلیدهای قدیمی را پاک کنید یا از IndexedDB adapter استفاده کنید. |
| `ZEN-1103` | storage | Runtime | مهاجرت (migrate) نسخهٔ داده شکست خورد. | Data migration failed. | تابع migrate را بررسی کنید؛ دادهٔ کهنه حذف یا نسخه‌بندی مجدد شود. |
| `ZEN-1104` | storage | Runtime | دادهٔ ذخیره‌شده خراب/غیرقابل‌تجزیه است. | Stored data is corrupt/unparseable. | کلید آسیب‌دیده حذف می‌شود؛ منبع داده را بازسازی کنید. |
| `ZEN-1201` | cache | Validation | ttl نامعتبر است. | Invalid ttl. | ttl باید عدد صحیح ≥ ۰ (میلی‌ثانیه) باشد؛ ۰ یعنی بدون انقضا. |
| `ZEN-1202` | cache | Runtime | loader کش شکست خورد. | Cache loader failed. | خطای اصلی در cause است؛ retry یا fallback را بررسی کنید. |
| `ZEN-1301` | i18n | Validation | تاریخ خارج از بازهٔ پشتیبانی‌شدهٔ تقویم جلالی است. | Date outside the supported Jalali calendar range. | بازهٔ مجاز ۱۲۰۱..۱۵۰۰ هجری شمسی است (DEC-020: به‌جای هشدار، throw). |
| `ZEN-1302` | i18n | Validation | قالب تاریخ نامعتبر. | Invalid date format. | توکن‌های مجاز: YYYY YY MM M DD D MMM MMMM؛ ترکیب ناشناخته را حذف کنید. |
| `ZEN-1303` | i18n | Validation | تاریخ نامعتبر (وجود ندارد). | Invalid date (does not exist). | روز/ماه را بررسی کنید (مثلاً ۱۵ اسفند ۳۰ روز نیست). |
| `ZEN-1311` | i18n | Runtime | کلید پیام پیدا نشد. | Message key not found. | کلید را به bundle اضافه کنید یا missing策略 (throw/warn/empty) را تغییر دهید. |
| `ZEN-1312` | i18n | Validation | قالب ICU نامعتبر است. | Invalid ICU format. | ساختار {plural, select, ...} را با مستندات i18n بسنجید. |
| `ZEN-1313` | i18n | Validation | locale پشتیبانی‌نشده. | Unsupported locale. | locale را در فهرست fallback ثبت کنید یا bundle آن را بارگذاری کنید. |
| `ZEN-1314` | i18n | Runtime | بارگذاری پیام‌ها شکست خورد. | Loading messages failed. | مسیر loader و شبکه را بررسی کنید؛ خطای اصلی در cause است. |
| `ZEN-1401` | a11y | Runtime | المان focusable برای focus-trap پیدا نشد. | No focusable element found for focus-trap. | حداقل یک عنصر focusable داخل container بگذارید یا trap را غیرفعال کنید. |
| `ZEN-1402` | a11y | Runtime | trap تودرتو با ترتیب پشتیبانی‌نشده. | Nested trap with unsupported order. | از پشتهٔ داخلی trap استفاده کنید؛ المان‌های trap را تودرتوی دستی نکنید. |
| `ZEN-1403` | a11y | Validation | ویژگی aria-* با نقش المان ناسازگار است. | aria-* attribute incompatible with the element role. | ترکیب role/aria را با WAI-ARIA ARIA in HTML تطبیق دهید. |
| `ZEN-1501` | head | Validation | تگ مجاز نیست. | Tag not allowed. | فهرست allowlist §head را ببینید؛ تگ‌های بدنه در head ممنوع‌اند. |
| `ZEN-1502` | head | Validation | JSON-LD نامعتبر. | Invalid JSON-LD. | object را با JSON.stringify serializable کنید و schema.org را بررسی نمایید. |
| `ZEN-1503` | head | Validation | تعداد تگ‌ها از maxTags بیشتر شد. | Tag count exceeded maxTags. | تگ‌ها را ادغام کنید یا maxTags را آگاهانه افزایش دهید. |
| `ZEN-1601` | ui | Runtime | المان trigger پیدا نشد. | Trigger element not found. | selector trigger را اصلاح یا وقت render بودن آن را بررسی کنید. |
| `ZEN-1602` | ui | Validation | zen-tab بدون zen-tabpanel متناظر. | zen-tab without a matching zen-tabpanel. | برای هر tab یک panel با aria-controls هم‌نام بگذارید. |
| `ZEN-1603` | ui | Validation | مقدار value خارج از گزینه‌ها. | Value outside the options. | value باید یکی از مقادیر options باشد (یا placeholder مجاز است). |
| `ZEN-1604` | ui | Runtime | portal مقصد ندارد. | Portal has no target. | target portal باید به المان موجود در DOM اشاره کند. |
| `ZEN-1701` | realtime | Network | اتصال برقراری نشد. | Connection failed. | URL/شبکه را بررسی کنید؛ backoff خودکار در حال تلاش مجدد است. |
| `ZEN-1702` | realtime | Network | پیام نامعتبر (parse شکست). | Invalid message (parse failed). | فرمت پیام (default: JSON) را با parser سرویس تطبیق دهید. |
| `ZEN-1703` | realtime | Security | پروتکل ناامن: ws:// در صفحهٔ https. | Insecure protocol: ws:// on an https page. | از wss:// استفاده کنید (mixed-content). |
| `ZEN-1704` | realtime | Runtime | صف ارسال پر است. | Send queue full. | نرخ ارسال را کم یا maxQueueSize را افزایش دهید؛ پیام‌های drop‌شده در details‌اند. |
| `ZEN-1705` | realtime | Network | heartbeat timeout. | Heartbeat timeout. | heartbeatInterval سرویس و اتصال را بررسی کنید؛ reconnect خودکار آغاز می‌شود. |
| `ZEN-1801` | adapters | Runtime | رندر SSR با timeout متوقف شد. | SSR render stopped by timeout. | renderTimeoutMs را افزایش یا داده‌های کندِ path را به suspense ببرید. |
| `ZEN-1802` | adapters | Validation | template نامعتبر: نشانگر خروجی نیست. | Invalid template: no output marker. | <!--zen-outlet--> (یا کانفیگ marker) داخل template بگذارید. |
| `ZEN-1803` | adapters | Runtime | AsyncLocalStorage در این runtime در دسترس نیست. | AsyncLocalStorage unavailable in this runtime. | context صریح (domImpl/ALS-free مسیر #92) را فعال کنید (DEC-022). |
| `ZEN-1811` | adapters | Runtime | runtime پشتیبانی نمی‌شود. | Unsupported runtime. | Node ≥18.19، Cloudflare Workers یا Deno (DEC-027) را انتخاب کنید. |
| `ZEN-1812` | adapters | Runtime | DOM implementation نصب نیست. | DOM implementation not installed. | linkedom یا happy-dom را به‌عنوان dependency نصب کنید (domImpl). |
| `ZEN-1821` | adapters | Runtime | مسیر در SSG رندر نشد. | Route failed to render during SSG. | path در routes/paths پیکربندی وجود دارد و prerender سبز شد را بررسی کنید. |
| `ZEN-1822` | adapters | Runtime | داده در زمان build در دسترس نیست. | Data unavailable at build time. | منبع داده را در build stage در دسترس کنید یا مسیر را CSR/ISR کنید. |
| `ZEN-1901` | analytics | Runtime | ارائه‌دهندهٔ آنالیتیکس شکست خورد (خطا بلعیده نمی‌شود؛ جدا از برنامه گزارش شد). | Analytics provider failed (error not swallowed; reported separately). | provider را موقتاً غیرفعال کنید؛ خطای اصلی در cause است. |
| `ZEN-1902` | analytics | Security | رضایت کاربر لازم است. | User consent required. | قبل از track، consent manager را فعال کنید (GDPR). |
| `ZEN-2001` | theme | Validation | token تم نامعتبر. | Invalid theme token. | نام token در تعریف theme وجود دارد و مقدار CSS-valid است. |
| `ZEN-2002` | theme | Runtime | ذخیره‌گاه تم در دسترس نیست. | Theme storage unavailable. | storage تم را memory یا جایگزین قرار دهید. |
| `ZEN-2101` | auth-oauth | Security | state مطابق نیست (احتمال CSRF). | state mismatch (possible CSRF). | flow را از همان مرورگر/تب ادامه دهید؛ state یک‌بارمصرف است (RFC 6749 §10.12). |
| `ZEN-2102` | auth-oauth | Security | id_token نامعتبر. | Invalid id_token. | issuer/audience و امضا (JWKS) را بررسی کنید. |
| `ZEN-2103` | auth-oauth | Network | discovery شکست خورد. | Discovery failed. | آدرس /.well-known/openid-configuration سرویس را بررسی کنید. |
| `ZEN-2104` | auth-oauth | Security | refresh منقضی. | Refresh expired. | کاربر را مجدداً وارد کنید (re-auth)؛ refresh token را تمدید سیاست‌پذیر کنید. |
| `ZEN-2105` | auth-oauth | Security | callback بدون code. | Callback without code. | response_type=code را در authorize بگذارید؛ error را از query parse کنید. |
| `ZEN-2201` | feature-flags | Runtime | پرچم تعریف نشده (فقط dev). | Flag not defined (dev only). | flag را در registry ثبت کنید؛ در prod مقدار default مصرف می‌شود. |
| `ZEN-2202` | feature-flags | Runtime | بارگذاری source پرچم‌ها شکست خورد. | Failed to load the flag source. | منبع (remote/file) و شبکه را بررسی کنید؛ fallback cached در کار است. |
| `ZEN-2301` | runtime-core | Runtime | onMount/onUnmount/onUpdate خارج از محدودهٔ directive/کامپوننت. | onMount/onUnmount/onUpdate outside directive/component scope. | این قلاب‌ها فقط حین اجرای تابع directive یا setup کامپوننت مجازند. |
| `ZEN-2302` | runtime-core | Validation | تعارض directive ساختاری روی یک المان. | Conflicting structural directives on one element. | zen-if و zen-for (و همتایان else) را روی المان‌های جدا بگذارید (SPEC §۲.۸ priority). |
| `ZEN-2303` | runtime-core | Validation | zen-for بدون zen-key. | zen-for without zen-key. | zen-key یکتا و پایدار برای هر آیتم بگذارید (همان ZEN-101؛ برای API جدید core). |
| `ZEN-2310` | runtime-core | Runtime | عدم تطابق hydration. | Hydration mismatch. | در dev diff چاپ می‌شود؛ در prod بازرندر موضعی انجام می‌گیرد. خروجی SSR/client را یکسان کنید. |
| `ZEN-2320` | runtime-core | Runtime | نسخهٔ پکیج‌ها lockstep نیست (assertCompatible). | Package versions not in lockstep (assertCompatible). | همهٔ @zenith/* را به یک نسخه (DEC-026) برسانید؛ نسخه‌های مشاهده‌شده در details است. |
| `ZEN-2401` | devtools-core | Runtime | نسخهٔ hook ناسازگار. | Incompatible hook version. | devtools و runtime را هم‌نسخه کنید (lockstep، DEC-026). |
| `ZEN-2402` | devtools-core | Runtime | snapshot نامعتبر. | Invalid snapshot. | ساختار snapshot §devtools-core را رعایت کنید؛ فیلدهای اجباری را بفرستید. |
| `ZEN-2501` | tooling | Validation | نام پروژه نامعتبر. | Invalid project name. | فقط [a-z0-9-_.]؛ بدون ..، مسیر مطلق یا جداکننده (create-zenith §۳.۹). |
| `ZEN-2510` | tooling | Runtime | متادیتا (zenith.meta.json) بارگذاری نشد. | Metadata (zenith.meta.json) failed to load. | build با meta:true اجرا شده و مسیر فایل درست است؟ |
| `ZEN-2520` | tooling | Runtime | پلاگین روی این bundler پشتیبانی نمی‌شود. | Plugin not supported on this bundler. | unplugin فقط rollup/vite/webpack/rspack را پشتیبانی می‌کند (SPEC §۴.۴). |
| `ZEN-2521` | tooling | Runtime | HMR ناسازگار. | Incompatible HMR. | نسخهٔ bundler/پلاگین را تطبیق یا HMR را غیرفعال کنید. |
| `ZEN-2530` | tooling | Runtime | درخواست بدون handler (mock). | Request without handler (mock). | handler متناظر ثبت یا onUnhandledRequest را bypass کنید؛ مسیر/متد در details است. |
| `ZEN-2531` | tooling | Runtime | handler دوبار پاسخ داد (mock). | Handler responded twice (mock). | هر resolver فقط یک respond() صدا بزند (passthrough با respond ترکیب نشود). |
| `ZEN-9001` | cli | Internal | خواندن فایل ممکن نیست (check). | Unable to read file (check). | مجوز/مسیر فایل را بررسی کنید (جایگزین Z001 قدیمی). |
| `ZEN-9100` | cli | Security | compileAndRender حذف‌شده (نام‌امن) استفاده شده است. | Removed compileAndRender is used (unsafe). | از zen-text یا zen-html با عبارت پیش‌کتبهٔ امن استفاده کنید (جایگزین Z100 قدیمی). |
| `ZEN-9101` | cli | Security | استفاده از eval() یا new Function() در <script>. | Use of eval() or new Function() in <script>. | الگوی eval برای امنیت (XSS) در Zenith ممنوع است (جایگزین Z101 قدیمی). |
| `ZEN-9200` | cli | Compiler | directive منسوخ‌شده. | Deprecated directive. | جایگزین رسمی را طبق جدول DEPRECATED_DIRECTIVES به‌کار ببرید (جایگزین Z200 قدیمی). |
| `ZEN-9201` | cli | Compiler | directive ناشناخته. | Unknown directive. | املای zen-* را با فهرست directiveهای معتبر بسنجید (جایگزین Z201 قدیمی). |
| `ZEN-9300` | cli | Runtime | zen-for بدون zen-key. | zen-for without zen-key. | zen-key یکتا برای هر آیتم اضافه کنید (DOM thrashing/state loss؛ جایگزین Z300 قدیمی). |
| `ZEN-9301` | cli | Compiler | zen-text با عبارت خالی. | zen-text with an empty expression. | عبارت معتبر بدهید یا directive را حذف کنید (جایگزین Z301 قدیمی). |
| `ZEN-9302` | cli | Compiler | zen-if با عبارت خالی. | zen-if with an empty expression. | عبارت شرطی معتبر بدهید (جایگزین Z302 قدیمی). |
| `ZEN-9400` | cli | Security | zen-html با متغیر قابل‌تزریق احتمالی. | zen-html with a probably injectable variable. | ورودی را sanitizeHTML کنید یا allowlist پیش‌فرض را حفظ کنید (جایگزین Z400 قدیمی). |
| `ZEN-9500` | cli | Security | الگوی دایرکتوری‌تراورسال در مسیر. | Directory traversal pattern in path. | مسیر را به ریشهٔ پروژه محدود کنید (جایگزین Z500 قدیمی). |
| `ZEN-9600` | cli | Security | secret احتمالی در کد. | Potential secret in code. | کلید/توکن را به env منتقل کنید (جایگزین Z600 قدیمی). |
| `ZEN-9601` | cli | Security | referrer ضعیف در head. | Weak referrer policy in head. | referrerpolicy را no-referrer یا strict-origin-when-cross-origin کنید (جایگزین Z601 قدیمی). |
| `ZEN-9700` | cli | Network | fetch با scheme ناامن (http). | fetch with an insecure scheme (http). | https استفاده کنید یا الگوی URL را بازبینی کنید (جایگزین Z700 قدیمی). |
| `ZEN-9800` | cli | Security | attribute رویدادی (on*) در template. | Event attribute (on*) in template. | از zen-click/zen-action (event delegation امن) استفاده کنید (جایگزین Z800 قدیمی). |
| `ZEN-9810` | cli | Security | iframe بدون sandbox. | iframe without sandbox. | sandbox محدودکننده برای iframe بگذارید (جایگزین Z810 قدیمی). |
| `ZEN-9820` | cli | Security | link خارجی بدون rel=noopener. | External link without rel=noopener. | rel="noopener noreferrer" به target=_blank اضافه کنید (جایگزین Z820 قدیمی). |

## کدهای ۳رقمی (کلاسیک — renumber نمی‌شوند)

| کد | توضیح (EN) |
|---|---|
| `ZEN-001` | Variable is not defined in the context. |
| `ZEN-002` | Access to a forbidden property in the expression (security). |
| `ZEN-003` | Forbidden identifier in the expression (security). |
| `ZEN-004` | Expression syntax error. |
| `ZEN-005` | The expression is not a function. |
| `ZEN-006` | Unknown operator in the expression. |
| `ZEN-007` | Unknown node type in the expression AST. |
| `ZEN-101` | zen-for requires zen-key. |
| `ZEN-102` | Invalid zen-for syntax. |
| `ZEN-103` | zen-for element has no parent. |
| `ZEN-104` | zen-if element has no parent. |
| `ZEN-105` | Directive expression evaluation failed. |
| `ZEN-106` | Component not found in the registry. |
| `ZEN-107` | Component dispose failed. |
| `ZEN-201` | Resource has been destroyed. |
| `ZEN-202` | HTTP error while fetching the resource. |
| `ZEN-203` | Resource URL evaluation failed. |
| `ZEN-204` | Resource signal not found. |
| `ZEN-205` | Resource mutation failed. |
| `ZEN-301` | SSR requires a DOM implementation (JSDOM-compatible). |
| `ZEN-302` | Root element not found for SSR. |
| `ZEN-303` | AsyncLocalStorage unavailable for SSR isolation. |
| `ZEN-304` | Hydration mismatch between server and client markup. |
| `ZEN-401` | XSS blocked: untrusted markup neutralized. |
| `ZEN-402` | Sanitization failed: input rejected. |
| `ZEN-403` | Secure random source unavailable. |
| `ZEN-404` | Insecure token storage detected. |
| `ZEN-501` | Unknown directive at compile time. |
| `ZEN-502` | Compile-time expression error. |
| `ZEN-503` | Compile-time syntax error. |
| `ZEN-504` | Missing import at compile time. |
| `ZEN-551` | Sandbox (VM) runtime error. |
| `ZEN-552` | Sandbox timeout. |
| `ZEN-553` | Sandbox memory limit exceeded. |
| `ZEN-601` | Route not found. |
| `ZEN-602` | Lazy route loading failed. |
| `ZEN-603` | Navigation aborted by a guard. |
| `ZEN-701` | Form validation failed. |
| `ZEN-702` | Form schema invalid. |
| `ZEN-801` | Slot not found. |
| `ZEN-802` | Required prop missing. |
| `ZEN-901` | Unknown internal error. |
| `ZEN-905` | Internal runtime failure. |
| `ZEN-906` | Internal reactivity failure. |
| `ZEN-907` | Developer precondition violated (assert). |
| `ZEN-908` | Internal hydration mismatch. |

## قوانین `zenith check` (CLI)

قوانین امنیت/کیفیت `zenith check` در بازهٔ `ZEN-9000..9899` هستند (جایگزین شناسه‌های قدیمی Z001..Z820 در #102).

---

لینک آنلاین هر کد: `https://zenith.dev/errors/<code>`.
