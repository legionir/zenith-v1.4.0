/**
 * @zenith/language-server — the known-directive registry (#160).
 *
 * Freshness without a new dependency: the lookup names come from
 * `@zenith/compiler` (`COMPILABLE_DIRECTIVES`, `RUNTIME_DIRECTIVES`,
 * `CORE_DIRECTIVES` — all `@public`), so a new compiler directive is known to
 * the server after a version bump. The prose/hover layer has no per-directive
 * metadata in the compiler, so descriptions are hand-written from the two
 * curated in-repo sources, cited below:
 *
 * - `docs/meta/zenith.meta.seed.json` (the DirectiveMeta seed; ATTRIBUTE-GRAMMAR
 *   calls it the single source of truth the language-server must consume);
 * - the `builtins` vocabulary in `packages/eslint-plugin/src/template.ts`
 *   (what the repo lint accepts, the server accepts — no false positives).
 *
 * Full binder/grammar migration for every legacy directive stays with #120;
 * this table records set membership (`compilable`/`runtime`/`core`) as fact
 * and never invents option lists for entries the seed does not document.
 */
import {
  COMPILABLE_DIRECTIVES,
  CORE_DIRECTIVES,
  RUNTIME_DIRECTIVES,
} from '@zenith/compiler';

/** Where a directive is known from. @public */
export type ZenithDirectiveKind = 'compilable' | 'runtime' | 'core' | 'registered';

/** Curated documentation for one directive. @public */
export interface ZenithDirectiveInfo {
  name: string;
  kind: ZenithDirectiveKind;
  description: string;
  syntax?: string;
  docs?: string;
}

/**
 * Seed-registry names (`docs/meta/zenith.meta.seed.json`), the authoritative
 * prose source for hover/completion documentation.
 */
const SEED_DIRECTIVE_NAMES: readonly string[] = [
  'zen-action',
  'zen-action-button',
  'zen-animate',
  'zen-auth',
  'zen-auth-view',
  'zen-bind',
  'zen-buffer',
  'zen-cloak',
  'zen-component',
  'zen-dir',
  'zen-dynamic-heights',
  'zen-else',
  'zen-else-if',
  'zen-fetch',
  'zen-field',
  'zen-for',
  'zen-form',
  'zen-html',
  'zen-html-slot',
  'zen-html-trusted',
  'zen-if',
  'zen-intersection',
  'zen-item-height',
  'zen-key',
  'zen-link',
  'zen-locale',
  'zen-memo',
  'zen-model',
  'zen-outlet',
  'zen-persist',
  'zen-portal',
  'zen-prevent-default',
  'zen-props',
  'zen-ref',
  'zen-resource',
  'zen-resource-view',
  'zen-route',
  'zen-show',
  'zen-static',
  'zen-stop-propagation',
  'zen-store',
  'zen-submit',
  'zen-t',
  'zen-t-attr',
  'zen-t-html',
  'zen-text',
  'zen-transition',
  'zen-validate',
  'zen-date-picker',
  'zen-dialog',
  'zen-popover',
  'zen-tooltip',
  'zen-tabs',
  'zen-accordion',
  'zen-menu',
  'zen-combobox',
  'zen-focus-trap',
  'zen-autofocus',
  'zen-inert',
  'zen-scroll-lock',
  'zen-roving',
  'zen-live',
  'zen-announce',
  'zen-reduced-motion',
  'zen-head',
  'zen-head-title',
  'zen-head-description',
  'zen-head-canonical',
  'zen-head-og-image',
];

/**
 * Lint-builtin names (`packages/eslint-plugin/src/template.ts`) with no seed
 * or compiler entry. The repo lint accepts them, so the server accepts them
 * too (kind `registered`, generic hover — no invented semantics).
 */
const LINT_DIRECTIVE_NAMES: readonly string[] = [
  'zen-empty',
  'zen-i18n',
  'zen-focus',
  'zen-trap-focus',
  'zen-fetch-options',
  'zen-fetch-state',
  'zen-resource-options',
  'zen-resource-state',
  'zen-transition-options',
  'zen-title',
  'zen-meta',
  'zen-script',
  'zen-tab',
  'zen-panel',
  'zen-menu-item',
  'zen-accordion-trigger',
  'zen-accordion-panel',
  'zen-auth-role',
  'zen-auth-permission',
  'zen-error-text',
];

const CORE_DIRECTIVE_SET: ReadonlySet<string> = new Set(CORE_DIRECTIVES);

/**
 * Every directive name the server recognizes (base form, no `:param`).
 *
 * @public
 */
export const KNOWN_DIRECTIVES: ReadonlySet<string> = new Set([
  ...COMPILABLE_DIRECTIVES,
  ...RUNTIME_DIRECTIVES,
  ...CORE_DIRECTIVE_SET,
  ...SEED_DIRECTIVE_NAMES,
  ...LINT_DIRECTIVE_NAMES,
]);

/**
 * The compiler-style lookup name: `zen-bind:href` → `zen-bind`,
 * `zen-action:click.prevent` → `zen-action`
 * (`packages/compiler/src/analyze-element.ts`).
 *
 * @public
 */
export function directiveBaseName(raw: string): string {
  return raw.split(':')[0]!;
}

/**
 * True when the attribute name is a known directive (parametric forms count).
 *
 * @public
 */
export function isKnownDirective(raw: string): boolean {
  return KNOWN_DIRECTIVES.has(directiveBaseName(raw));
}

/**
 * Which set a base name is known from (`compilable` > `runtime` > `core` >
 * `registered`). Unknown names report `registered` — callers must check
 * `isKnownDirective` first when the distinction matters.
 *
 * @public
 */
export function directiveKindOf(base: string): ZenithDirectiveKind {
  if (COMPILABLE_DIRECTIVES.has(base)) return 'compilable';
  if (RUNTIME_DIRECTIVES.has(base)) return 'runtime';
  if (CORE_DIRECTIVE_SET.has(base)) return 'core';
  return 'registered';
}

interface DirectiveDoc {
  description: string;
  syntax?: string;
  docs?: string;
}

/**
 * Seed-registry prose, condensed from `docs/meta/zenith.meta.seed.json`
 * (descriptions/syntax/docs kept verbatim where quoted).
 */
const SEED_DOCS: Readonly<Record<string, DirectiveDoc>> = {
  'zen-action': {
    description: 'اتصال یک action از رجیستری @zenith/actions به رویداد؛ form پارامتریک zen-action:<event>.<modifier>.',
    syntax: '<button zen-action="save"> / <button zen-action:click.prevent="save">',
    docs: 'https://zenith.dev/docs/events#zen-action',
  },
  'zen-action-button': {
    description: 'کامپوننت اعلانی دکمهٔ action با حالت loading.',
    syntax: '<zen-action-button action="save" loading-text="…">ذخیره</zen-action-button>',
    docs: 'https://zenith.dev/docs/stateful#zen-action-button',
  },
  'zen-animate': {
    description: 'انیمیشن با Web Animations API؛ preset یا keyframes.',
    syntax: '<div zen-animate="fade-in">',
    docs: 'https://zenith.dev/docs/transition#zen-animate',
  },
  'zen-auth': {
    description: 'اتصال عنصر به نمونهٔ auth.',
    syntax: '<div zen-auth="session">…</div>',
    docs: 'https://zenith.dev/docs/auth#zen-auth',
  },
  'zen-auth-view': {
    description: 'کامپوننت اعلانی نمایش وضعیت احراز هویت.',
    syntax: '<zen-auth-view config="session"></zen-auth-view>',
    docs: 'https://zenith.dev/docs/stateful#zen-auth-view',
  },
  'zen-bind': {
    description: 'اتصال expression به یک attribute HTML؛ form پارامتریک zen-bind:<attr>.',
    syntax: '<a zen-bind:href="item.url">…</a>',
    docs: 'https://zenith.dev/docs/runtime#zen-bind',
  },
  'zen-buffer': {
    description: 'تعداد آیتم بافر بالا/پایین virtual-list.',
    syntax: '<div zen-route="/list" zen-buffer="5">',
    docs: 'https://zenith.dev/docs/virtual-list#zen-buffer',
  },
  'zen-cloak': {
    description: 'حذف attribute هنگام mount تا CSS [zen-cloak]{display:none} جلوی FOUC را بگیرد؛ boolean (وجود = فعال).',
    syntax: '<div zen-cloak zen-text="$user.name">…</div>',
    docs: 'https://zenith.dev/docs/runtime#zen-cloak',
  },
  'zen-component': {
    description: 'تعریف کامپوننت سفارشی روی عنصر.',
    syntax: '<div zen-component="user-card" zen-props=\'{"id":1}\'>',
    docs: 'https://zenith.dev/docs/components#zen-component',
  },
  'zen-dir': {
    description: 'attribute dirِ المان — ltr|rtl|auto (auto ⇒ جهت جاری i18n؛ واکنشی).',
    syntax: '<section zen-dir="auto"></section>',
    docs: 'https://zenith.dev/docs/i18n#zen-dir',
  },
  'zen-dynamic-heights': {
    description: 'ارتفاع پویا برای آیتم‌های virtual-list.',
    syntax: '<div zen-route="/list" zen-dynamic-heights="true">',
    docs: 'https://zenith.dev/docs/virtual-list#zen-dynamic-heights',
  },
  'zen-else': {
    description: 'شاخهٔ جایگزین zen-if (همراه).',
    syntax: '<div zen-if="$a">A</div><div zen-else>B</div>',
    docs: 'https://zenith.dev/docs/runtime-core#zen-else',
  },
  'zen-else-if': {
    description: 'شاخهٔ شرطی بعدی zen-if (همراه).',
    syntax: '<div zen-if="$a">A</div><div zen-else-if="$b">B</div>',
    docs: 'https://zenith.dev/docs/runtime-core#zen-else-if',
  },
  'zen-fetch': {
    description: 'درخواست HTTP از URL و نوشتن نتیجه در state (نام کلید با zen-state، پیش‌فرض data).',
    syntax: '<div zen-fetch="/api/users" zen-fetch-method="GET" zen-fetch-cache="30000" zen-state="users">…</div>',
    docs: 'https://zenith.dev/docs/data#zen-fetch',
  },
  'zen-field': {
    description: 'میدان فرم.',
    syntax: '<input zen-field="email" zen-validate="required,email">',
    docs: 'https://zenith.dev/docs/form#zen-field',
  },
  'zen-for': {
    description: 'تکرار المان روی هر آیتم یک collection؛ باید با zen-key همراه باشد.',
    syntax: '<li zen-for="item in items" zen-key="item.id">{{ item.name }}</li>',
    docs: 'https://zenith.dev/docs/runtime#zen-for',
  },
  'zen-form': {
    description: 'تعریف فرم با schema.',
    syntax: '<form zen-form="userSchema">…</form>',
    docs: 'https://zenith.dev/docs/form#zen-form',
  },
  'zen-html': {
    description: 'رندر HTML با Sanitizer؛ مقدار یک expression است.',
    syntax: '<div zen-html="$trusted.markup"></div>',
    docs: 'https://zenith.dev/docs/runtime#zen-html',
  },
  'zen-html-slot': {
    description: 'نام slot برای محتوای کامپوننت.',
    syntax: '<span zen-html-slot="header">…</span>',
    docs: 'https://zenith.dev/docs/components#zen-html-slot',
  },
  'zen-html-trusted': {
    description: 'رندر HTML بدون Sanitizer؛ فقط برای محتوای واقعاً مورداعتماد (مسئولیت امنیت با کاربر).',
    syntax: '<div zen-html-trusted="$raw.html"></div>',
    docs: 'https://zenith.dev/docs/runtime#zen-html-trusted',
  },
  'zen-if': {
    description: 'رندر شرطی: المان فقط وقتی expression truthy است در DOM می‌ماند.',
    syntax: '<div zen-if="isLoggedIn">…</div>',
    docs: 'https://zenith.dev/docs/runtime#zen-if',
  },
  'zen-intersection': {
    description: 'lazy-load با IntersectionObserver.',
    syntax: '<img zen-intersection="$onVisible">',
    docs: 'https://zenith.dev/docs/runtime#zen-intersection',
  },
  'zen-item-height': {
    description: 'ارتفاع آیتم در virtual-list (px).',
    syntax: '<div zen-route="/list" zen-item-height="48">',
    docs: 'https://zenith.dev/docs/virtual-list#zen-item-height',
  },
  'zen-key': {
    description: 'کلید پایدار آیتم در zen-for برای diffing دقیق.',
    syntax: '<li zen-for="item in items" zen-key="item.id">…</li>',
    docs: 'https://zenith.dev/docs/runtime#zen-key',
  },
  'zen-link': {
    description: 'لینک SPA برای ناوبری بدون reload.',
    syntax: '<a zen-link="/users">Users</a>',
    docs: 'https://zenith.dev/docs/router#zen-link',
  },
  'zen-locale': {
    description: 'marker فقط؛ attribute langِ المان = locale جاری i18n (واکنشی).',
    syntax: '<section zen-locale></section>',
    docs: 'https://zenith.dev/docs/i18n#zen-locale',
  },
  'zen-memo': {
    description: 'کش محاسبهٔ درون‌خطی برای بلوک.',
    syntax: '<div zen-memo="$expensive">…</div>',
    docs: 'https://zenith.dev/docs/runtime-core#zen-memo',
  },
  'zen-model': {
    description: 'دوطرفه binding بین مقدار ورودی فرم و signal.',
    syntax: '<input zen-model="form.name" />',
    docs: 'https://zenith.dev/docs/runtime#zen-model',
  },
  'zen-outlet': {
    description: 'outlet رندر route فعال.',
    syntax: '<main zen-outlet></main>',
    docs: 'https://zenith.dev/docs/router#zen-outlet',
  },
  'zen-persist': {
    description: 'مقدار zen-model را زیر کلید داده‌شده در @zenith/storage ذخیره و هنگام mount بازیابی می‌کند؛ فقط روی المان دارای zen-model معنا دارد.',
    syntax: '<input zen-model="$form.user" zen-persist="cart.user" zen-persist-driver="local" />',
    docs: 'https://zenith.dev/docs/storage#zen-persist',
  },
  'zen-portal': {
    description: 'جابجایی عنصر به container دیگر.',
    syntax: '<div zen-portal="#modal-root">',
    docs: 'https://zenith.dev/docs/runtime#zen-portal',
  },
  'zen-prevent-default': {
    description: 'preventDefault روی رویداد.',
    syntax: '<form zen-action:submit zen-prevent-default="true">',
    docs: 'https://zenith.dev/docs/events#zen-prevent-default',
  },
  'zen-props': {
    description: 'نگاشت propهای کامپوننت (JSON).',
    syntax: '<div zen-component="card" zen-props=\'{"title":"x"}\'>',
    docs: 'https://zenith.dev/docs/components#zen-props',
  },
  'zen-ref': {
    description: 'اتصال عنصر DOM به یک signal در state (دسترسی به نود بدون querySelector).',
    syntax: '<canvas zen-ref="chartCanvas"></canvas>',
    docs: 'https://zenith.dev/docs/runtime#zen-ref',
  },
  'zen-resource': {
    description: 'اتصال Resource (CRUD/lifecycle) به DOM؛ نام state خروجی با zen-state.',
    syntax: '<div zen-resource="\'/api/users\'" zen-state="users">…</div>',
    docs: 'https://zenith.dev/docs/resource#zen-resource',
  },
  'zen-resource-view': {
    description: 'کامپوننت اعلانی نمایش resource.',
    syntax: '<zen-resource-view config="users" empty-text="خالی">',
    docs: 'https://zenith.dev/docs/stateful#zen-resource-view',
  },
  'zen-route': {
    description: 'تعریف route در zen-router.',
    syntax: '<div zen-route="/users">…</div>',
    docs: 'https://zenith.dev/docs/router#zen-route',
  },
  'zen-show': {
    description: 'toggle visibility با display:none (برخلاف zen-if المان در DOM می‌ماند).',
    syntax: '<div zen-show="isOpen">…</div>',
    docs: 'https://zenith.dev/docs/runtime#zen-show',
  },
  'zen-static': {
    description: 'fast-path برای zen-for: per-item Signal ساخته نمی‌شود و تغییر لیست full re-render می‌کند؛ boolean.',
    syntax: '<li zen-for="row in rows" zen-static>…</li>',
    docs: 'https://zenith.dev/docs/runtime#zen-static',
  },
  'zen-stop-propagation': {
    description: 'stopPropagation روی رویداد.',
    syntax: '<button zen-action:click zen-stop-propagation="true">',
    docs: 'https://zenith.dev/docs/events#zen-stop-propagation',
  },
  'zen-store': {
    description: 'اتصال عنصر به store.',
    syntax: '<div zen-store="cart">…</div>',
    docs: 'https://zenith.dev/docs/store#zen-store',
  },
  'zen-submit': {
    description: 'action ارسال فرم.',
    syntax: '<form zen-form="s" zen-submit="saveUser">',
    docs: 'https://zenith.dev/docs/form#zen-submit',
  },
  'zen-t': {
    description: 'ترجمهٔ پیام با کلید از @zenith/i18n؛ واکنشی به تغییر locale. همراه: zen-t-params (JSON)، zen-t-count (عدد برای plural)، zen-t-default (متن جایگزین).',
    syntax: '<span zen-t="greeting" zen-t-params=\'{"name":"علی"}\'></span>',
    docs: 'https://zenith.dev/docs/i18n#zen-t',
  },
  'zen-t-attr': {
    description: 'ترجمهٔ چند attribute با نگاشت "attr:key; attr2:key2"؛ همراه: zen-t-params.',
    syntax: '<input zen-t-attr="title:form.title; aria-label:form.aria" />',
    docs: 'https://zenith.dev/docs/i18n#zen-t-attr',
  },
  'zen-t-html': {
    description: 'ترجمهٔ پیام HTML‌شده با sanitize (پیش‌فرض: escape کامل).',
    syntax: '<div zen-t-html="welcome.rich" zen-t-params=\'{"name":"علی"}\'></div>',
    docs: 'https://zenith.dev/docs/i18n#zen-t-html',
  },
  'zen-text': {
    description: 'رندر متن واکنش‌گرا (textContent — بدون خطر تزریق HTML).',
    syntax: '<span zen-text="$user.name"></span>',
    docs: 'https://zenith.dev/docs/runtime#zen-text',
  },
  'zen-transition': {
    description: 'نام transition ثبت‌شده برای enter/leave المان‌های شرطی.',
    syntax: '<div zen-if="open" zen-transition="fade">…</div>',
    docs: 'https://zenith.dev/docs/transition#zen-transition',
  },
  'zen-validate': {
    description: 'قواعد اعتبارسنجی میدان (CSV).',
    syntax: '<input zen-field="email" zen-validate="required,email">',
    docs: 'https://zenith.dev/docs/form#zen-validate',
  },
  'zen-date-picker': {
    description: 'تقویم جلالی/میلادی با محدودیت تاریخ، range و مالکیت فرم.',
    syntax: '<zen-date-picker calendar="gregorian" value="2024-02-29" format="YYYY-MM-DD" name="date"></zen-date-picker>',
    docs: 'https://zenith.dev/docs/ui#date-picker',
  },
  'zen-dialog': {
    description: 'دیالوگ modal/nonmodal با focus تحت مالکیت و مقدار بازشوندهٔ دوطرفه.',
    docs: 'https://zenith.dev/docs/ui#dialog',
  },
  'zen-popover': {
    description: 'سطح شناور با مقدار بازشوندهٔ دوطرفه و هندسهٔ تحت مالکیت.',
    docs: 'https://zenith.dev/docs/ui#popover',
  },
  'zen-tooltip': {
    description: 'tooltip توصیفی با intent مستقل focus و hover.',
    docs: 'https://zenith.dev/docs/ui#tooltip',
  },
  'zen-tabs': {
    description: 'مجموعهٔ تب APG با انتخاب کنترل‌شدهٔ واکنش‌گرا و پنل‌های lazy.',
    docs: 'https://zenith.dev/docs/ui#tabs',
  },
  'zen-accordion': {
    description: 'مجموعهٔ disclosure با انتخاب کنترل‌شده.',
    docs: 'https://zenith.dev/docs/ui#accordion',
  },
  'zen-menu': {
    description: 'منوی کیبوردی با آیتم‌های check/radio و زیرمنوهای تودرتو.',
    docs: 'https://zenith.dev/docs/ui#menu',
  },
  'zen-combobox': {
    description: 'listbox تحت مالکیت با options واکنش‌گرا، مقدار کنترل‌شده و جستجوی ناهمگام قابل لغو.',
    docs: 'https://zenith.dev/docs/ui#combobox',
  },
  'zen-focus-trap': {
    description: 'trap واکنش‌گرای focus تحت مالکیت.',
    docs: 'https://zenith.dev/docs/a11y#focus-trap',
  },
  'zen-autofocus': {
    description: 'focus وقتی یک expression boolean درست می‌شود.',
    docs: 'https://zenith.dev/docs/a11y#autofocus',
  },
  'zen-inert': {
    description: 'lease واکنش‌گرای inert تحت مالکیت.',
    docs: 'https://zenith.dev/docs/a11y#inert',
  },
  'zen-scroll-lock': {
    description: 'قفل شمارش‌شدهٔ واکنش‌گرای اسکرول.',
    docs: 'https://zenith.dev/docs/a11y#scroll-lock',
  },
  'zen-roving': {
    description: 'tab-stopهای چرخشی کیبورد با بازیابی تحت مالکیت.',
    docs: 'https://zenith.dev/docs/a11y#roving',
  },
  'zen-live': {
    description: 'attributeهای live-region تحت مالکیت (role، politeness، atomic).',
    docs: 'https://zenith.dev/docs/a11y#live',
  },
  'zen-announce': {
    description: 'اعلان live متنی-واکنش‌گرا.',
    docs: 'https://zenith.dev/docs/a11y#announce',
  },
  'zen-reduced-motion': {
    description: 'ترجیح reduced-motion تحت مالکیت.',
    docs: 'https://zenith.dev/docs/a11y#reduced-motion',
  },
  'zen-head': {
    description: 'محتوای head نویسنده (title/meta/link/base/JSON-LD) تحت مالکیت.',
    docs: 'https://zenith.dev/docs/head#zen-head',
  },
  'zen-head-title': {
    description: 'ورودی title واکنش‌گرای head.',
    docs: 'https://zenith.dev/docs/head#zen-head-title',
  },
  'zen-head-description': {
    description: 'ورودی description واکنش‌گرای head.',
    docs: 'https://zenith.dev/docs/head#zen-head-description',
  },
  'zen-head-canonical': {
    description: 'ورودی canonical واکنش‌گرای head.',
    docs: 'https://zenith.dev/docs/head#zen-head-canonical',
  },
  'zen-head-og-image': {
    description: 'ورودی og-image واکنش‌گرای head.',
    docs: 'https://zenith.dev/docs/head#zen-head-og-image',
  },
};

/**
 * Short kind-grounded prose for compiler/core names the seed does not
 * document. Parametric examples are quoted only where a parity suite
 * (`packages/compiler/src/parity.ts`) pins the form; the rest carry no
 * syntax rather than an invented one.
 */
const CORE_DOCS: Readonly<Record<string, DirectiveDoc>> = {
  'zen-on': {
    description: 'اتصال handler به رویداد DOM؛ form پارامتریک zen-on:<event>.',
    syntax: '<button zen-on:click="clicked = clicked + 1">Click</button>',
  },
  'zen-hide': {
    description: 'کنترل visibility المان با expression (در کنار zen-show).',
    syntax: '<div zen-hide="isCollapsed">…</div>',
  },
  'zen-class': {
    description: 'toggle کلاس با form پارامتریک zen-class:<name> و مقدار boolean.',
    syntax: '<div zen-class:active="active">Test</div>',
  },
  'zen-style': {
    description: 'اتصال خاصیت CSS با form پارامتریک zen-style:<prop>.',
    syntax: '<div zen-style:color="color">Test</div>',
  },
  'zen-attr': {
    description: 'اتصال attribute با expression (هستهٔ parity).',
  },
  'zen-prop': {
    description: 'اتصال propertyٔ DOM با expression (هستهٔ parity).',
  },
  'zen-effect': {
    description: 'اجرای effect واکنش‌گرا (هستهٔ parity).',
  },
  'zen-loading': {
    description: 'نمایش وضعیت بارگذاری (هستهٔ parity).',
  },
  'zen-slot': {
    description: 'نقطهٔ درج محتوای کامپوننت (هستهٔ parity).',
  },
  'zen-permission': {
    description: 'نمایش شرطی بر اساس permission کاربر (runtime).',
  },
  'zen-role': {
    description: 'نمایش شرطی بر اساس role کاربر (runtime).',
  },
  'zen-error': {
    description: 'نمایش وضعیت خطا (runtime).',
  },
  'zen-suspense': {
    description: 'مرز suspense برای محتوای ناهمگام (runtime).',
  },
  'zen-virtual-list': {
    description: 'فهرست مجازی برای مجموعه‌های بزرگ (runtime).',
  },
  'zen-login': {
    description: 'action ورود (auth؛ runtime).',
  },
  'zen-logout': {
    description: 'action خروج (auth؛ runtime).',
  },
  'zen-track': {
    description: 'اتصال ردیابی analytics به المان (runtime).',
  },
  'zen-optimistic': {
    description: 'به‌روزرسانی optimistic رابط کاربری (runtime).',
  },
  'zen-island': {
    description: 'جزیرهٔ hydration جزئی (runtime).',
  },
  'zen-virtual': {
    description: 'مجازی‌سازی (runtime).',
  },
  'zen-router': {
    description: 'ریشه/پیکربندی router (runtime).',
  },
  'zen-button': {
    description: 'دکمهٔ اعلانی (runtime).',
  },
  'zen-if-chain': {
    description: 'زنجیرهٔ شرطی داخلی runtime.',
  },
};

/**
 * Curated documentation for a base directive name, or `null` when unknown.
 *
 * @public
 */
export function describeDirective(base: string): ZenithDirectiveInfo | null {
  if (!KNOWN_DIRECTIVES.has(base)) return null;
  const kind = directiveKindOf(base);
  const doc = SEED_DOCS[base] ?? CORE_DOCS[base];
  if (doc === undefined) {
    return {
      name: base,
      kind,
      description: 'شناخته‌شده در گرامر template (پذیرفتهٔ lint)؛ جزئیات در مستندات پکیج مالک.',
    };
  }
  return { name: base, kind, description: doc.description, syntax: doc.syntax, docs: doc.docs };
}

/**
 * All known base names, sorted (completion source).
 *
 * @public
 */
export function listKnownDirectives(): string[] {
  return [...KNOWN_DIRECTIVES].sort((a, b) => a.localeCompare(b));
}

function levenshtein(a: string, b: string): number {
  const previous: number[] = [];
  for (let j = 0; j <= b.length; j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0]!;
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const substitution = diagonal + (a[i - 1] === b[j - 1] ? 0 : 1);
      diagonal = previous[j]!;
      previous[j] = Math.min(previous[j]! + 1, previous[j - 1]! + 1, substitution);
    }
  }
  return previous[b.length]!;
}

/**
 * Closest known base name within `maxDistance` (default 2), or `null`.
 * Ties break alphabetically, so results are deterministic.
 *
 * @public
 */
export function closestDirectiveName(input: string, maxDistance = 2): string | null {
  let best: string | null = null;
  let bestDistance = maxDistance + 1;
  for (const name of KNOWN_DIRECTIVES) {
    const distance = levenshtein(input, name);
    if (distance < bestDistance || (distance === bestDistance && (best === null || name < best))) {
      best = name;
      bestDistance = distance;
    }
  }
  return bestDistance <= maxDistance ? best : null;
}
