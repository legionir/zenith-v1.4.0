
## 📌 مقدمه و اصول کلی
Zenith یک فریم‌ورک فرانت‌اند **HTML-First** با معماری مبتنی بر **Signal** و بدون Virtual DOM است. تمام توسعه بر اساس سه اصل اصلی انجام می‌شود:
1. **واکنش‌گرایی مبتنی بر سیگنال:** تمام تغییرات حالت از طریق سیگنال‌ها مدیریت می‌شوند
2. **اولویت HTML:** منطق از طریق دستورات `zen-*` به HTML متصل می‌شود، نه برعکس
3. **ایمنی و عملکرد:** کد تولید شده باید ایمن، بهینه و بدون نشت حافظه باشد

### 📖 اصطلاحات کلیدی
| اصطلاح | تعریف |
|---|---|
| Signal | کانتینر واکنش‌گرا برای مقادیر؛ با `.get()` خوانده و با `.set()` تغییر می‌کند |
| Computed | مقدار مشتق‌شده خودکار که فقط در صورت تغییر وابستگی‌ها دوباره محاسبه می‌شود |
| Effect | تابعی که در هر تغییر سیگنال‌های داخلی‌اش دوباره اجرا می‌شود |
| Owner Tree | ساختار درختی برای مدیریت چرخه عمر افکت‌ها و جلوگیری از نشت حافظه |
| Directive | دستور `zen-*` در HTML برای اتصال منطق به عناصر DOM |
| Hydration | فرآیند فعال‌سازی منطق روی HTML ساخته شده توسط سرور |

---

## 🚨 قوانین الزامی برای توسعه با Zenith
این قوانین همیشه باید رعایت شوند:
1. ✅ همیشه از `signal`، `computed` و `effect` از پکیج `@zenith/state` استفاده کنید
2. ✅ برای مدیریت چرخه عمر، از `createRoot` و `onCleanup` استفاده کنید
3. ✅ دسترسی به DOM مستقیم فقط در صورت لزوم و ترجیحاً از طریق `@zenith/dom`
4. ✅ برای فرم‌ها از `@zenith/form` و برای اعتبارسنجی از `@zenith/validators` استفاده کنید
5. ✅ برای درخواست‌های HTTP از `@zenith/http` استفاده کنید و هرگز `fetch` خام مستقیماً در افکت‌ها صدا نزنید
6. ✅ احراز هویت و کنترل دسترسی فقط از طریق `@zenith/auth`
7. ❌ هرگز سیگنال‌ها را داخل حلقه‌ها یا شرط‌های پویا بدون مدیریت مالکیت ایجاد نکنید
8. ❌ هرگز به توابع حساس مانند `eval`، `Function`، `call`، `apply` در عبارات دسترسی ندهید
9. ❌ از تغییر مستقیم DOM به جای دستورات رسمی `zen-*` خودداری کنید

---

## 📦 مستندات خلاصه API بر اساس پکیج‌ها
اطلاعات کامل هر پکیج در فایل‌های جداگانه `docs/packages/<name>.md` موجود است. این بخش خلاصه سریع است.

### 🔹 هسته اصلی
#### `@zenith/state` — سیستم واکنش‌گرا
```typescript
import { signal, computed, effect, createRoot, onCleanup, batch, untracked } from '@zenith/state';

const count = signal(0);                    // ایجاد سیگنال
count.get();                                // خواندن مقدار
count.set(5);                               // تنظیم مقدار جدید
count.update(prev => prev + 1);             // به‌روزرسانی بر اساس مقدار قبلی

const doubled = computed(() => count() * 2); // مقدار محاسبه‌شده

const disposeEffect = effect(() => {        // افکت واکنش‌گرا
  console.log(count());
  onCleanup(() => {});                      // پاکسازی قبل از اجرای مجدد
});

const disposeRoot = createRoot(() => {});   // ریشه مستقل
batch(() => {});                            // تغییرات دسته‌ای
untracked(() => count());                   // خواندن بدون ثبت وابستگی
```

#### `@zenith/runtime` — زمان اجرا
```typescript
import { Zen } from '@zenith/runtime';
import { hydrate } from '@zenith/ssr';

const dispose = Zen.start('#app', state, {  // راه‌اندازی اپلیکیشن
  devtools: true,
  validateHydration: true,
  auth: { autoRefresh: true }
});
Zen.stop();                                 // توقف کامل
hydrate('#app', serverState);               // هیدریشن از سرور
Zen.onError(err => {});                     // هندلر خطای سراسری
Zen.toasts.success('پیام');                 // اعلان سریع
```

#### `@zenith/scheduler` — زمان‌بندی
```typescript
import { schedule, flushSync, nextTick, pause, resume } from '@zenith/scheduler';

schedule(() => {}, 'urgent');               // اولویت: urgent | normal | idle
flushSync();                                // اجرای فوری تمام کارها
nextTick(() => {});                         // اجرا پس از اتمام آپدیت‌ها
pause(); resume();                          // توقف/از سرگیری
```

#### `@zenith/expressions` — موتور عبارات
```typescript
import { compileExpression, evaluate, isSafeExpression } from '@zenith/expressions';

isSafeExpression('user.name');              // بررسی امنیت
const fn = compileExpression('a + b');      // کامپایل به تابع
fn({ a: 1, b: 2 });                         // اجرا
evaluate('age >= 18', { age: 20 });         // اجرای مستقیم
```

#### `@zenith/compiler` — کامپایلر قالب
```typescript
import { compileTemplate, parseDirectives, runParityTests } from '@zenith/compiler';

const result = compileTemplate(html, { sourceMap: true, optimizeBindings: true });
parseDirectives(element);                   // استخراج دستورات از DOM
runParityTests();                           // بررسی سازگاری کامپایلر و زمان اجرا
```

### 🔹 ابزارهای DOM و HTML
#### `@zenith/dom` — عملیات DOM
```typescript
import { qs, qsa, on, attr, classes, style, create, clear } from '@zenith/dom';

qs('#id'); qsa('.class');                   // انتخاب عناصر
const remove = on(el, 'click', handler);    // ثبت رویداد با قابلیت لغو
attr(el, 'name', 'value');                  // ویژگی‌ها
classes(el, { active: true });              // کلاس‌ها
style(el, { color: 'red' });                // استایل‌ها
create('div', { class: 'box' }, ['متن']);   // ساخت عنصر
clear(el);                                  // پاکسازی محتوا
```

#### `@zenith/html` — ایمن‌سازی و ساخت HTML
```typescript
import { escapeHtml, sanitizeHtml, tag, parseHtml, stripTags } from '@zenith/html';

escapeHtml(userInput);                      // گریخته سازی
sanitizeHtml(dirtyHtml);                    // پاکسازی محتوای کاربر
tag('a', { href: '/' }, 'خانه');           // ساخت تگ ایمن
parseHtml('<div>متن</div>');                // تجزیه به DOM
stripTags(html);                            // حذف تمام تگ‌ها
```

#### `@zenith/core` — توابع پایه
```typescript
import { deepClone, deepEqual, mergeDeep, pick, omit, uid, debounce, throttle } from '@zenith/core';

deepClone(obj); deepEqual(a, b);            // کپی و مقایسه عمیق
mergeDeep({}, a, b);                        // ادغام عمیق
pick(obj, ['a', 'b']); omit(obj, ['c']);    // انتخاب/حذف کلیدها
uid('prefix_');                             // شناسه یکتا
debounce(fn, 300); throttle(fn, 200);       // کنترل فراخوانی
```

### 🔹 دستورات HTML (`zen-*`)
همیشه از این الگوها استفاده کنید:
```html
<!-- اتصال ویژگی -->
<button zen-bind:disabled="isLoading" zen-bind:class="{ active: isActive }">ارسال</button>

<!-- محتوا -->
<h2 zen-text="user.name"></h2>
<div zen-html="safeContent"></div>

<!-- شرط -->
<div zen-if="user.isAdmin">پنل مدیریت</div>
<div zen-else-if="user.isEditor">پنل ویرایش</div>
<div zen-else>پنل کاربری</div>

<!-- تکرار (همیشه zen-key استفاده کنید) -->
<ul>
  <li zen-for="item in items" zen-key="item.id" zen-text="item.name"></li>
</ul>

<!-- رویداد -->
<button zen-on:click="handleClick">کلیک</button>
<form zen-on:submit.prevent="submitForm">ارسال</form>

<!-- فرم دوطرفه -->
<input type="text" zen-model="username" />

<!-- نمایش/پنهان سازی با CSS -->
<div zen-show="isVisible">مشاهده می‌شود</div>
<div zen-hide="isHidden">پنهان است</div>
```

### 🔹 ماژول‌های کاربردی
#### `@zenith/router` — مسیریابی
```typescript
import { createRouter } from '@zenith/router';

const routes = [
  { path: '/', component: Home },
  { path: '/dashboard', component: Dashboard, guard: { requiresAuth: true } },
  { path: '/admin', component: Admin, guard: { roles: ['admin'], redirectTo: '/forbidden' } },
  { path: '/about', lazy: () => import('./About') } // بارگذاری تنبل
];
const router = createRouter(routes);
router.navigate('/path');
router.currentPath.get(); // مسیر فعلی سیگنال
router.params.get();      // پارامترها سیگنال
router.query.get();       // پارامترهای پرس‌وجو سیگنال
```

#### `@zenith/form` — سیستم فرم
```typescript
import { createForm, createWizardForm } from '@zenith/form';
import { required, email, minLength, combine } from '@zenith/validators';

const form = createForm({
  initialValues: { email: '', password: '' },
  validate: {
    email: combine([required(), email()]),
    password: combine([required(), minLength(8)])
  },
  onSubmit: async values => await api.login(values)
});

form.values.get();        // مقادیر سیگنال
form.errors.get();        // خطاها سیگنال
form.valid.get();         // اعتبار سیگنال
form.dirty.get();         // تغییر یافته بودن
await form.submit();      // ارسال
form.reset();             // بازنشانی
```

#### `@zenith/auth` — احراز هویت
```typescript
import { auth, configureAuth, initAuth, hasRole, hasPermission, canActivateRoute } from '@zenith/auth';

configureAuth({ endpoints: { login: '/api/auth/login' }, autoRefresh: true });
await initAuth();

const user = await auth.login({ email, password, remember: true });
await auth.logout();

auth.user.get();                // کاربر فعلی سیگنال
auth.isAuthenticated.get();     // وضعیت ورود سیگنال
hasRole('admin');               // بررسی نقش
hasPermission('users:delete');  // بررسی مجوز
canActivateRoute(guard);        // بررسی دسترسی مسیر
```

#### `@zenith/http` — درخواست‌های شبکه
```typescript
import { http, setHttpConfig, addRequestInterceptor, addErrorInterceptor } from '@zenith/http';

setHttpConfig({ baseURL: 'https://api.example.com', timeout: 15000 });
addRequestInterceptor(cfg => { cfg.headers.Authorization = `Bearer ${token}`; return cfg; });
addErrorInterceptor(err => { if (err.status === 401) logout(); });

const { data } = await http.get<User>('/users/1');
await http.post('/users', newUser);
await http.put('/users/1', updates);
await http.delete('/users/1');

const resource = http.resource<User[]>('/users'); // منبع واکنش‌گرا: data, loading, error, refetch
```

#### `@zenith/notifications` — اعلان‌ها
```typescript
import { notify, toasts, alert, confirm } from '@zenith/notifications';

toasts.success('موفق');
toasts.error('خطا');
toasts.warning('هشدار');
toasts.info('اطلاعات');

await alert({ title: 'توجه', message: 'پیام', type: 'warning' });
const ok = await confirm({ title: 'حذف', message: 'مطمئن هستید؟' });
```

#### `@zenith/data-table` — جدول داده
```typescript
import { createDataTable } from '@zenith/data-table';

const table = createDataTable<User>({
  columns: [
    { key: 'id', title: 'شناسه', sortable: true },
    { key: 'name', title: 'نام', sortable: true, filterable: true, editable: true }
  ],
  rowKey: 'id',
  pagination: { enabled: true, pageSize: 25 },
  sorting: { enabled: true, multiColumn: true },
  selection: { enabled: true, mode: 'multiple' }
});

table.setData(users);
table.sort('name', 'asc');
table.globalSearch.set('علی');
table.selectAll();
table.exportToCSV('data.csv');
```

#### `@zenith/i18n` — بین‌المللی‌سازی
```typescript
import { configureI18n, t, setLocale, formatDate, formatNumber } from '@zenith/i18n';

configureI18n({
  defaultLocale: 'fa',
  locales: { fa: { greeting: 'سلام {name}' }, en: { greeting: 'Hello {name}' } }
});
t('greeting', { name: 'علی' });
formatDate(new Date());
formatNumber(1000);
await setLocale('en');
```

#### `@zenith/ssr` — رندر سرور
```typescript
import { renderServer, hydrate, isServer, isClient, runOnServer, runOnClient } from '@zenith/ssr';

// سرور
const { html, state } = await renderServer('#app', initialState);
// کلاینت
hydrate('#app', window.__ZENITH_STATE__);

isServer(); isClient();
runOnServer(() => {}); // فقط سرور
runOnClient(() => {}); // فقط کلاینت
```

#### `@zenith/testing` — ابزار تست
```typescript
import { createTestHarness, renderTestComponent } from '@zenith/testing';

using test = createTestHarness();
const count = test.signal(0);
count.set(5);
test.flush();
expect(count.get()).toBe(5);

const { container, dispose } = renderTestComponent('<div zen-text="count"></div>', { count });
```

### 🔹 ابزارهای توسعه
#### افزونه‌های بیلد
- `@zenith/vite-plugin` — Vite
- `@zenith/webpack-plugin` — Webpack
- `@zenith/rollup-plugin` — Rollup

همگی رابط مشابهی دارند:
```typescript
import zenith from '@zenith/vite-plugin';
export default { plugins: [zenith({ include: ['**/*.html'], ssr: false })] };
```

#### `@zenith/eslint-plugin` — قوانین لینت
پیکربندی پیشنهادی:
```javascript
module.exports = {
  plugins: ['@zenith'],
  extends: ['plugin:@zenith/recommended'],
  rules: {
    '@zenith/zen-for-requires-zen-key': 'error',
    '@zenith/no-direct-dom-access': 'warn'
  }
};
```

#### `@zenith/cli` — خط فرمان
```bash
zenith create my-app       # ایجاد پروژه جدید
zenith dev --port 3000     # سرور توسعه
zenith build --minify      # ساخت نسخه نهایی
zenith test --coverage     # اجرای تست‌ها
zenith check               # بررسی کیفیت کد
```

---

## 🧩 الگوهای رایج و آماده استفاده

### الگوی ۱: شمارنده ساده
```typescript
import { signal, computed, effect } from '@zenith/state';
import { Zen } from '@zenith/runtime';

const state = {
  count: signal(0),
  doubled: computed(() => state.count.get() * 2),
  increment: () => state.count.update(c => c + 1),
  decrement: () => state.count.update(c => c - 1)
};

effect(() => console.log('شمارنده:', state.count.get()));
Zen.start('#app', state);
```
```html
<div id="app">
  <p>مقدار: <span zen-text="count"></span> | دوبرابر: <span zen-text="doubled"></span></p>
  <button zen-on:click="increment">+</button>
  <button zen-on:click="decrement">-</button>
</div>
```

### الگوی ۲: فرم ورود
```typescript
import { createForm } from '@zenith/form';
import { required, email, minLength, combine } from '@zenith/validators';
import { auth } from '@zenith/auth';
import { router } from './router';

const loginForm = createForm({
  initialValues: { email: '', password: '' },
  validate: {
    email: combine([required('ایمیل الزامی است'), email('فرمت ایمیل صحیح نیست')]),
    password: combine([required('رمز الزامی است'), minLength(8, 'رمز حداقل ۸ کاراکتر')])
  },
  onSubmit: async values => {
    const user = await auth.login(values);
    if (user) router.navigate('/dashboard');
  }
});

Zen.start('#app', { loginForm });
```
```html
<form id="app" zen-on:submit.prevent="loginForm.submit">
  <div>
    <input type="email" zen-model="loginForm.values.email" placeholder="ایمیل" />
    <span zen-if="loginForm.errors.email" zen-text="loginForm.errors.email" class="error"></span>
  </div>
  <div>
    <input type="password" zen-model="loginForm.values.password" placeholder="رمز عبور" />
    <span zen-if="loginForm.errors.password" zen-text="loginForm.errors.password" class="error"></span>
  </div>
  <button type="submit" zen-bind:disabled="!loginForm.valid || loginForm.submitting.get()">ورود</button>
</form>
```

### الگوی ۳: لیست داده با فیلتر
```typescript
import { signal, computed, effect } from '@zenith/state';
import { http } from '@zenith/http';

const state = {
  users: signal<User[]>([]),
  loading: signal(true),
  error: signal<string | null>(null),
  search: signal(''),
  filteredUsers: computed(() => {
    const query = state.search.get().toLowerCase();
    return state.users.get().filter(u => u.name.toLowerCase().includes(query));
  }),
  loadUsers: async () => {
    state.loading.set(true);
    state.error.set(null);
    try {
      const { data } = await http.get<User[]>('/api/users');
      state.users.set(data);
    } catch (e: any) {
      state.error.set(e.message);
    } finally {
      state.loading.set(false);
    }
  }
};

effect(() => { state.loadUsers(); });
Zen.start('#app', state);
```
```html
<div id="app">
  <input type="text" zen-model="search" placeholder="جستجوی کاربر..." />
  
  <div zen-if="loading">در حال بارگذاری...</div>
  <div zen-else-if="error" class="error">خطا: <span zen-text="error"></span></div>
  
  <ul zen-else>
    <li zen-for="user in filteredUsers" zen-key="user.id">
      <span zen-text="user.name"></span> — <span zen-text="user.email"></span>
    </li>
  </ul>
</div>
```

### الگوی ۴: محافظت از مسیر با احراز هویت
```typescript
import { createRouter } from '@zenith/router';
import { auth, configureAuth, initAuth } from '@zenith/auth';

configureAuth({ loginPath: '/login', autoRefresh: true });
await initAuth();

const routes = [
  { path: '/login', component: LoginPage },
  { path: '/dashboard', component: Dashboard, guard: { requiresAuth: true } },
  { path: '/admin', component: AdminPanel, guard: { requiresAuth: true, roles: ['admin'] } }
];

const router = createRouter(routes);
Zen.start('#app', { router, auth });
```

---

## ⚠️ خطاهای رایج و راه‌حل آن‌ها
| خطا/مشکل | علت | راه‌حل |
|---|---|---|
| افکت هیچ‌وقت اجرا نمی‌شود | سیگنال‌ها خارج از افکت خوانده شده‌اند یا در `untracked` قرار دارند | اطمینان حاصل کنید `.get()` سیگنال داخل بدنه اصلی افکت فراخوانی می‌شود |
| نشت حافظه و افزایش بی‌پایان مصرف حافظه | افکت‌ها داخل ریشه مدیریت نشده ایجاد شده‌اند | همیشه از `createRoot` استفاده کنید و در پایان `dispose` را صدا بزنید |
| `zen-for` رندر نادرست یا به‌روزرسانی اشتباه | استفاده نشدن از `zen-key` یا استفاده از کلید غیریکتا | همیشه `zen-key` با مقدار یکتا برای هر آیتم تنظیم کنید |
| رندر مجدد غیرضروری زیاد | سیگنال‌ها حتی با مقدار یکسان دچار آپدیت می‌شوند | از تابع `equals` سفارشی در گزینه‌های سیگنال استفاده کنید تا مقایسه دقیق‌تر انجام شود |
| خطای امنیت در عبارات | دسترسی به توابع حساس از طریق عبارات | هرگز ورودی کاربر را مستقیماً به عنوان عبارت کامپایل نشده اجرا نکنید؛ از `isSafeExpression` استفاده کنید |
| ناهماهنگی سرور و کلاینت در SSR | تولید HTML متفاوت در دو محیط | از `runOnServer` و `runOnClient` برای تفکیک منطق استفاده کنید و `validateHydration` را فعال کنید |
| حلقه بی‌نهایت در افکت | افکت مقدار سیگنالی را تغییر می‌دهد که خودش به آن وابسته است | از `untracked` برای خواندن مقادیری که نباید وابستگی ایجاد کنند استفاده کنید یا منطق را بازطراحی کنید |

---

## ✅ چک‌لیست کیفیت کد
قبل از تحویل کد، این موارد را بررسی کنید:
- [ ] تمام سیگنال‌ها و افکت‌ها درون یک `createRoot` مدیریت شده‌اند
- [ ] افکت‌هایی که نیاز به پاکسازی دارند از `onCleanup` استفاده می‌کنند
- [ ] تمام `zen-for`ها دارای `zen-key` یکتا هستند
- [ ] فرم‌ها از `@zenith/form` و اعتبارسنجی‌های مناسب استفاده می‌کنند
- [ ] درخواست‌های شبکه از طریق `@zenith/http` انجام شده‌اند
- [ ] مسیرهای حساس دارای `guard` مناسب در روتر هستند
- [ ] هیچ دسترسی مستقیم غیرضروری به DOM وجود ندارد
- [ ] ورودی‌های کاربر قبل از قرارگیری در HTML با `escapeHtml` یا `sanitizeHtml` ایمن شده‌اند
- [ ] کد دارای کامنت‌های توضیحی برای بخش‌های پیچیده است
- [ ] تست‌های مناسب برای منطق اصلی نوشته شده‌اند

---

## 📚 منابع تکمیلی
- مستندات کامل هر پکیج: `docs/packages/<name>.md`
- راهنمای شروع سریع: `docs/README.md`
- مثال‌های کاربردی: `demos/` پوشه
- تست‌های هسته: `tests/` پوشه
- معیارهای عملکرد: `benchmarks/` پوشه
