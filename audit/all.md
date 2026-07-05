🎯 فازبندی اجرایی
فاز ۰: بحرانی‌های امنیتی (Day 1-2)
باید قبل از انتشار بعدی انجام شود

#	باگ	پکیج	راهکار
1	XSS در Graph Viewer	devtools-extension (BUG-DEVTEXT-01)	جایگزینی innerHTML با textContent + SVG text element + DOMPurify
2	safeScriptValue escape ناقص	ssr (BUG-SSR-01)	افزودن replace(/\\/g, '\\\\') قبل از بقیه escape‌ها
3	Mutation XSS از طریق template tag	security (BUG-SEC-04)	بستن allowlist تگ‌ها، اضافه کردن template به DenyList
4	Prototype pollution در permission freeze	permission (BUG-PRM-01)	استفاده از Object.create(null) + deep recursive freeze
فاز ۱: بحرانی‌های درست‌کاری (Day 3-5)
#	باگ	پکیج	راهکار
5	SchedulerAdapter هرگز مصرف نمی‌شود	scheduler (B-01)	Dead code — یا حذف کامل یا wire up واقعی
6	data-zenith-runtime تنظیم نمی‌شود	vite-plugin (B-5)	String.replace → position-based replacement
7	String.replace فقط اولین occurrence	vite-plugin (B-4)	رویکرد slice-based به جای String.replace
8	IntersectionObserver در SSR	virtual-list (BUG-VL-01)	SSR guard با fallback به همیشه-visible
9	oldValue و newValue یکسان در state	state (BUG-01)	جابجایی recordStateChange قبل از this._value =
10	delegatedHandler closure قدیمی	events (B-2)	cache کردن actionAttribute در scope هر listener
11	async-loader race condition	components (B-2)	AbortController + Promise race cancellation
فاز ۲: باگ‌های بالا (High — Weeks 2-3)
#	باگ	پکیج	پیچیدگی
12	AbortController cleanup در fetch error	data (BUG-DAT-01)	⭐
13	deepProxy infinite loop با circular refs	store (BUG-STO-01)	⭐⭐⭐
14	matchRoute برای empty path segments	router (BUG-RTR-01)	⭐⭐
15	transitionend listener cleanup	transition (BUG-TRN-01)	⭐
16	equalsField cross-field validation	form (BUG-FRM-01)	⭐⭐
17	async validation race condition	form (BUG-FRM-02)	⭐⭐
18	_scheduleRefresh بعد از destroy	auth (BUG-AUT-01)	⭐
19	allowlist ناقص (XSS)	security (BUG-SEC-01)	⭐⭐
20	sanitizeHTML بدون DOMParser در SSR	security (BUG-SEC-02)	⭐⭐
21	cacheKey collision از JSON ordering	resource (B-1)	⭐
22	Optimistic rollback state incorrect	resource (B-2)	⭐⭐
23	crudDelete optimistic rollback	crud (BUG-CRD-01)	⭐
24	toJalali با تاریخ‌های قبل از 1600	i18n (BUG-I18N-01)	⭐
25	IndexedDB queue race condition	service-worker (BUG-SW-01)	⭐⭐
26	zen-html-trusted escaping issues	compiler (BUG-COMP-03)	⭐⭐
27	Unsupported directives caught silently	compiler (BUG-COMP-07)	⭐
28	Memory leak DevTools hook در HMR	devtools (BUG-DEV-01)	⭐⭐
29	isBuild تشخیص ناپایدار	vite-plugin (B-1)	⭐
30	pendingModules پاک نمی‌شود	vite-plugin (B-3)	⭐
31	DevTools path غیرقابل اطمینان	vite-plugin (B-6)	⭐
32	Nested Suspense race condition	suspense (BUG-SUS-01)	⭐⭐⭐
33	computation() دو بار اجرا می‌شود	state (BUG-03)	⭐⭐
34	onError listener leak	error-boundary (BUG-EB-02)	⭐
35	afterFlush عدم return disposer	scheduler (B-02)	⭐
فاز ۳: یکپارچگی Environment و ابزارها (Week 4)
#	باگ	پکیج	راهکار
36	lineComment: "<!--"	vscode-extension (B-1)	حذف فیلد lineComment
37	8 directive گم‌شده در syntax highlight	vscode-extension (B-2)	افزودن به tmLanguage.json
38	onLanguage:zenith-html ندارد	vscode-extension	افزودن به activationEvents
39	fs.readFileSync blocking	vscode-extension (B-4)	تبدیل به async I/O
40	Template literal ${a}${b} جمع می‌زند	expressions (B-1)	افزودن string خالی قبل از first expression
41	true/false/null/undefined به عنوان Identifier	expressions (B-2)	تبدیل در _parsePrimaryInner
42	host_permissions: <all_urls>	devtools-extension (BUG-DEVTEXT-08)	محدود کردن به دامنه‌های مشخص
43	DevTools WebView placeholder	vscode-extension (B-10)	اتصال CDP یا حذف موقت
فاز ۴: باگ‌های متوسط سیستمی (Week 5-6)
بیشترین باگ‌ها در این دسته قرار دارند (83 مورد). مهم‌ترین‌ها:

Memory & Cleanup:

پکیج	باگ	راهکار
runtime (11 مورد)	HMR leak, FOUC, event delegation, global leak	MutationObserver + visibilitychange + double-call protection
events (B-1)	clearBindingCache listener removal	WeakRef + cache invalidation
components (B-1)	FinalizationRegistry	SSR guard + polyfill
router (BUG-RTR-03)	cleanupRouter incomplete	enumeration تمام listeners
scheduler (B-05)	isFlushing never reset	finally block
Validation & Safety:

پکیج	باگ
form (BUG-FRM-03)	Array operations بدون index validation
form (BUG-FRM-04)	submit() بدون validation قبلی
data (BUG-DAT-04)	URL expression بدون validation
compiler (BUG-COMP-01,04,06)	Structural directive conflict, zen-for validation
cli (BUG-CLI-03)	Directory traversal در static server
فاز ۵: بهبودهای معماری (Week 7-8)
از مجموع 153 improvement درخواستی، اولویت با مواردی است که بیشترین impact را دارند:

Error types مجزا (expressions B-10) — ExpressionSyntaxError, ExpressionSecurityError, ExpressionRuntimeError
MAX_CACHE_SIZE قابل تنظیم (expressions I-2)
Cache metrics یکپارچه (expressions I-3)
SchedulerAdapter — wire up واقعی یا حذف کامل (scheduler B-01)
بازآرایی DI context (state) — break circular import بین signal.ts و effect.ts
Glob pattern به جای RegExp raw (vite-plugin I-2) — استفاده از micromatch
Sourcemap برای .zenith.js (vite-plugin I-4) — this.emitFile
LSP-like features برای VSCode — DefinitionProvider, ReferenceProvider تدریجی
Template literal stack-safe (expressions B-9)
CompiledTemplate cache یکپارچه (compiler + expressions)
