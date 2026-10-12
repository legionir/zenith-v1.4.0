# @zenith/schema

اعتبارسنجی گزینه‌ها/config با خطای `ZEN-1xxx` و تولید متادیتا برای ابزارها —
لایهٔ L0 (SPEC §۲.۲، issue #142).

استخراج از `@zenith/form` (`fromZod`, `validateWithZod`, `fromJsonSchema`) +
منطق تازه. سازندهٔ جدید `s.*`، `defineOptions`، `parseConfigAttr`،
`toJsonSchema`/`fromJsonSchema` و متادیتای directive را پوشش می‌دهد.

## اصول

- **L0 پاک:** وابستگی فقط `errors` + `shared`. `zod` هیچ‌وقت dependency نیست
  (دونگی `safeParse` — DEC-021)؛ `ajv` فقط devDependency ریشه برای تست
  meta-schema است.
- **بدون console:** حالت `mode:'warn'` از reporter تزریق‌شدهٔ
  `setSchemaWarnReporter` عبور می‌کند (مصرف‌کننده مثل runtime آن را به
  `@zenith/logger` وصل می‌کند؛ prod ساکت می‌ماند).
- **ESM-only از تولد 1.5.0** (DEC-027)؛ زیرمسیرهای `@zenith/schema/zod` و
  `@zenith/schema/json-schema`.
- **dev/prod:** پیش‌فرض `mode` از `globalThis.__ZENITH_DEV__` می‌آید
  (dev: `throw`، prod: `warn`) — DEC-020.

## API

```ts
import {
  s, // سازنده‌ها: string/number/boolean/enum/duration/fn/signal/element/
  // array/record/object/union/optional/default/custom
  validate, // (schema, input, opts?) => T — mode throw|warn|result
  safeValidate, // (schema, input, opts?) => { ok: true, value } | { ok: false, issues }
  defineOptions, // (name, schema, defaults?) => { DEFAULTS, resolve(user), schema }
  parseConfigAttr, // (el, attr, schema) => T — JSON از attribute؛ ZEN-1003
  setSchemaWarnReporter, // duck-seam هشدار (بدون console در L0)
  toJsonSchema, // Schema → JSON Schema Draft 2020-12
  fromJsonSchema, // JSON Schema (subset) → Schema
  defineDirectiveMeta, // ثبت متادیتای directive (kebab-case + description)
  toDirectiveManifest, // zenith.meta.json
  toHtmlCustomData, // فرمت VS Code html.customData
} from '@zenith/schema';

const chart = defineOptions(
  'zen-chart',
  s.object({
    legend: s.default(s.boolean(), false),
    ttl: s.default(s.duration(), 1000),
    title: s.optional(s.string()),
  }),
);
chart.resolve({ ttl: '30s' }); // { legend: false, ttl: 30000, … }
```

گزینه‌های `ValidateOptions`: `mode`، `strict` (پیش‌فرض true — کلید ناشناخته
⇒ `ZEN-1002`)، `coerce` (`"5"`→5؛ مسیر attribute همیشه true)، `abortEarly`،
`name` (در `details.name` خطا).

## خطاها

| کد | مورد |
|---|---|
| `ZEN-1001` | گزینهٔ نامعتبر (مسیر، انتظار، مقدار در `details.issues`) |
| `ZEN-1002` | کلید ناشناخته در حالت strict |
| `ZEN-1003` | JSON خراب در attribute (`parseConfigAttr`) |
| `ZEN-1004` | مقدار خارج از بازه (min/max طول یا عددی) |

## zenith.meta.json / html.customData.json

متادیتای directive در `docs/meta/zenith.meta.seed.json` ثبت و با
`node scripts/gen-zenith-meta.mjs` به `docs/meta/zenith.meta.json` +
`docs/meta/html.customData.json` serialize می‌شود؛ تازگی اسنپ‌شات در CI با
`--check` گیت می‌شود (`scripts/test/meta-snapshot.test.mjs`). فهرست کامل
directiveها در #52/#148/#173 به همان seed/رجیستری راه پیدا می‌کند.

## مهاجرت از form

`form.fromZod`/`form.validateWithZod`/`form.fromJsonSchema` (که `FormStore`
می‌ساختند) در `@zenith/form` با همان امضا مانده‌اند و deprecated شده‌اند
(`ZEN-DEPR-016..018`؛ حذف در 2.0 — DEC-026). منطق خالص اعتبارسنجی حالا اینجاست:

- `fromZod(zod)` ⇒ گرهٔ `Schema` (به‌جای FormStore).
- `validateWithZod(zod, input)` ⇒ `SafeResult` (به‌جای فرم-level error).
- `fromJsonSchema(doc)` ⇒ `Schema` (به‌جای FormStore).

## تست و بودجه

`packages/schema/test/` — هستۀ اعتبارسنجی، لایه‌بندی L0، env-import/SSR،
zod دونگی، json-schema با meta-schema رسمی (ajv)، manifest/snapshot و
size-budget ≤ ۴KB gzip.
