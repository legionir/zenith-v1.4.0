# @zenith/compiler

پیش‌کامپایلر قالب‌های Zenith (فاز ۱۲) — قالب HTML را به JavaScript بهینه تبدیل می‌کند تا در زمان اجرا walker و parse دوباره انجام نشود.

## نصب

```bash
npm install @zenith/compiler
```

## استفاده

```typescript
import { compileTemplate } from '@zenith/compiler';

const { code } = await compileTemplate('<h1 zen-text="$user.name"></h1>', {
  strict: false, // directive ناشناخته = warning و واگذاری به runtime
});
```

خروجی `CompiledTemplate` است؛ فیلد `code` تعریف تابع `render` و قرارداد تزریق وابستگی‌های آن را نگه می‌دارد. بسته‌بندی ماژول و اتصال runtime در `@zenith/vite-plugin` انجام می‌شود.

## مستندات مرتبط

- [ARCHITECTURE.md §۳ و §۴](../../ARCHITECTURE.md)
- [README ریشه](../../README.md)

## مجوز

MIT

## Shared-API migration candidate (unvalidated)

```ts
const results = runParityTest(suite, { runtimeRunner, compilerRunner });
const report = runAllParityTests({ runtimeRunner, compilerRunner });
```

Runner bags are checked by the shared schema for callability; callback signatures
and string return values remain caller-declared, not decoded. Callbacks receive the original
case/state objects; `ParityTestContext.state` values are `unknown`, so consumers
must narrow them. The positional overloads remain available with once-only
warnings `ZEN-DEPR-090/091` (proposed removal in 2.0).

Browser parsing uses native `DOMParser`. In Node, install the declared optional
peer `jsdom@^24`; a missing parser rejects with the existing actionable message.
The private parser result honestly admits a Promise. No new DOM implementation,
mandatory browser dependency, or consumer-build support claim is implied.
Module moves and these source/API changes are classified separately in the
[migration ledger](../../docs/API-MIGRATION-CANDIDATE-2026-10-17.md).
