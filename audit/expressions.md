# گزارش حسابرسی @zenith/expressions

> **نسخه:** 1.3.0  
> **مسیر:** packages/expressions/  
> **نوع:** Expression Engine — Lexer, Parser, Validator, Evaluator, LRU Cache  
> **تاریخ:** 1405-04-10 (July 2026)

---

## ۱. باگ‌ها و نواقص (Bugs)

### B-1: الحاق اعداد در Template Literal های پشت‌سر هم (`${a}${b}`)

**فایل:** [expressions/src/lexer.ts](packages/expressions/src/lexer.ts) ~ خط ۲۲۲

در مبحث Template Literal، وقتی دو interpolation پشت‌سر هم قرار می‌گیرند (بدون متن بین آن‌ها) کد فعلی عملگر `+` بین آن‌ها قرار می‌دهد:

```
`${a}${b}`  →  Identifier("a") + Identifier("b")
```

در جاوااسکریپت، `\`${a}${b}\`` همیشه **رشته** تولید می‌کند (`String(a) + String(b)`). اما کد فعلی از عملگر `+` بدون String coercion استفاده می‌کند، بنابراین اگر `a=1` و `b=2` باشد، نتیجه `3` می‌شود (جمع عددی) به‌جای `"12"`.

**سناریوی شکست:**
```typescript
evaluate('`${a}${b}`', { $a: signal(1), $b: signal(2) })
// نتیجه فعلی: 3  (عدد — اشتباه)
// نتیجه درست: "12"  (رشته)
```

**راه‌حل:** در lexer، برای اولین interpolation در یک template literal، اگر متن قبل از آن وجود ندارد (یا همان اولین بخش است)، یک `String("")` خالی قبل از اولین expression قرار دهیم تا `+` با String literal عمل concatenation انجام دهد:

```typescript
// در lexer, هنگام مواجهه با اولین ${} در template literal:
if (firstPart) {
    // اضافه کردن string خالی برای اطمینان از string concatenation
    tokens.push({ type: TokenType.String, value: '', start: i, end: i });
    tokens.push({ type: TokenType.Punctuator, value: '+', start: i, end: i });
    firstPart = false;
}
```

---

### B-2: عدم پشتیبانی از Literal Keywords `true`، `false`، `null` و `undefined`

**فایل:** [expressions/src/parser.ts](packages/expressions/src/parser.ts) ~ خط ۴۰۱

Parser این کلمه‌ها را به‌عنوان `Identifier` تشخیص می‌دهد. وقتی evaluator آنها را در Context جستجو می‌کند، پیدا نمی‌کند و خطای `variableNotDefinedError` پرتاب می‌کند.

**سناریوی شکست:**
```typescript
evaluateExpression('true', {})  // ← variableNotDefinedError
evaluateExpression('null', {})  // ← variableNotDefinedError
evaluateExpression('undefined', {}) // ← variableNotDefinedError
```

**راه‌حل:** در `_parsePrimaryInner`، قبل از بررسی `Identifier`، نام token را با `true`/`false`/`null`/`undefined` مقایسه کرده و `Literal` برگردانیم:

```typescript
if (token.type === TokenType.Identifier) {
    const name = token.value;
    if (name === 'true') { this.consume(); return { type: 'Literal', value: true }; }
    if (name === 'false') { this.consume(); return { type: 'Literal', value: false }; }
    if (name === 'null') { this.consume(); return { type: 'Literal', value: null }; }
    if (name === 'undefined') { this.consume(); return { type: 'Literal', value: undefined }; }
    this.consume();
    return { type: 'Identifier', name };
}
```

---

### B-3: استفاده از متد `substr` منسوخ‌شده

**فایل:** [expressions/src/lexer.ts](packages/expressions/src/lexer.ts) ~ خطوط ۱۱۸, ۱۳۰, ۲۴۱, ۲۵۰

```typescript
const hex = input.substr(i + 2, 4);
```

`String.prototype.substr()` در ES2019 **منسوخ (deprecated)** اعلام شده و در اجرای Strict Mode در مرورگرهای مدرن warning می‌دهد.

**سناریوی شکست:** ابزارهای لینت مانند ESLint با rule `prefer-string-slice` خطا می‌دهند. همچنین در بعضی runtime‌های مدرن (Deno، Bun) ممکن است عملکرد متفاوتی داشته باشد.

**راه‌حل:** جایگزینی با `substring` یا `slice`:

```typescript
const hex = input.slice(i + 2, i + 6);  // برای `\uXXXX` (4 hex digits)
const hex = input.slice(i + 2, i + 4);  // برای `\xXX` (2 hex digits)
```

---

### B-4: Optional Chaining فقط برای Dot Notation (`?.`) پشتیبانی می‌شود

**فایل:** [expressions/src/parser.ts](packages/expressions/src/parser.ts) ~ خط ۳۳۰

فقط `?.` (optional dot access) پشتیبانی می‌شود، اما `?.[]` (optional computed access) پشتیبانی نمی‌شود. در جاوااسکریپت، `obj?.[expr]` معتبر است.

**سناریوی شکست:**
```
$obj?.[$key]  ← Parser خطا می‌دهد چون ?. اول مصرف می‌شود و سپس [ می‌آید
```

**راه‌حل:** در `parseMemberOrCall`، بعد از مصرف `?.` یا `.`، چک کنیم که اگر بعد از property `[` آمد، آن را به‌عنوان computed access با `optional: true` parse کنیم.

---

### B-5: خطای `CallExpression` با پیام گمراه‌کننده وقتی `thisArg` برابر null است

**فایل:** [expressions/src/evaluator.ts](packages/expressions/src/evaluator.ts) ~ خط ۱۷۳

وقتی `thisArg` برابر `null` است اما `optional` روی `false` است (یعنی `?.` استفاده نشده)، `callee` برابر `undefined` می‌شود و خطای `"Expression is not a function"` پرتاب می‌شود. خطای درست‌تر باید `"Cannot read properties of null"` باشد.

**سناریوی شکست:**
```typescript
// context: {}
evaluateExpression('$nonexistent.method()', {})
// خطای فعلی: "Expression is not a function"
// خطای درست‌تر: "Cannot read properties of undefined"
```

---

### B-6: عملگر + به‌عنوان عملگر یکانی پشتیبانی نمی‌شود

**فایل:** [expressions/src/parser.ts](packages/expressions/src/parser.ts) ~ خط ۳۰۷

Parser از `+` به‌عنوان عملگر یکانی پشتیبانی نمی‌کند (فقط `!` و `-`). در جاوااسکریپت، `+"123"` → `123` (تغییر نوع به عدد) معتبر است.

**سناریوی شکست:**
```
+"123"  ← Parser این را به‌عنوان BinaryExpression با left=خالی parse نمی‌کند
```

**راه‌حل:** افزودن `'+'` به `matchAny(['!', '-', '+'])` در `parseUnary()`.

---

### B-7: Depth guard فقط از Stack Overflow جلوگیری می‌کند ولی ReDoS از نوع Catastrophic Backtracking را نه

**فایل:** [expressions/src/parser.ts](packages/expressions/src/parser.ts) ~ خط ۱۱۷

```typescript
private static readonly MAX_DEPTH = 200;
```

Depth guard از stack overflow جلوگیری می‌کند اما از catastrophic backtracking در regex های lexer جلوگیری نمی‌کند. مثل regex مربوط به Number literals که در صورت ورودی `000...0` (تعداد زیادی صفر) با backtracking مواجه نمی‌شود (چون greedy نیست). اما الگوی `/\szen-[a-z]/i` در سایر پکیج‌ها ممکن است ReDoS-prone باشد.

**اهمیت:** کم — lexer از regexهای ساده و ایمن استفاده می‌کند.

---

### B-8: `NullishCoalescing` در validator بررسی می‌شود اما دو بار

**فایل:** [expressions/src/validator.ts](packages/expressions/src/validator.ts) ~ خط ۱۷۱

```typescript
case 'NullishCoalescing':
    validate(node.left);
    validate(node.right);
    break;
case 'BinaryExpression':
case 'LogicalExpression':
    validate(node.left);
    validate(node.right);
    break;
```

کد تکراری دارد. می‌توان `NullishCoalescing` را با `BinaryExpression` ادغام کرد:

```typescript
case 'BinaryExpression':
case 'LogicalExpression':
case 'NullishCoalescing':
    validate(node.left);
    validate(node.right);
    break;
```

---

### B-9: `lex()` در template literal یک Parser جدید می‌سازد اما depth آن ردیابی نمی‌شود

**فایل:** [expressions/src/lexer.ts](packages/expressions/src/lexer.ts) ~ خط ۲۱۰

```typescript
const allExprTokens = lex(expr);
```

وقتی درون template literal یک `${}` وجود دارد، `lex(expr)` صدا زده می‌شود. این یک lexer جدید است. اما tokens آن به Parser اصلی برگردانده می‌شوند. Depth guard فقط depth parser را چک می‌کند، نه عمق تودرتوی template literalها. بنابراین یک `\`${...${...${...}}}\`` می‌تواند depth را دور بزند.

**سناریوی شکست:** Expression با template literal تودرتو می‌تواند depth guard را دور بزند و باعث stack overflow شود.

**راه‌حل:** اضافه کردن یک پارامتر depth به `lex()` که در فراخوانی بازگشتی افزایش یابد و وقتی از حد گذشت خطا بدهد.

---

### B-10: Shared ErrorType برای همه‌ی خطاها

تمام خطاهای lexer، parser، validator و evaluator از `Error` استفاده می‌کنند. مصرف‌کننده‌ی API نمی‌تواند به راحتی نوع خطا را تشخیص دهد:

| نوع خطا | Error class فعلی |
|---------|-----------------|
| Lexer Error | `Error` |
| Syntax Error | `Error` |
| Security Error | `Error` |
| Runtime Error | `Error` |

**سناریوی شکست:** کدی که `compileExpression()` را صدا می‌زند نمی‌تواند بین syntax error و security error تفاوت قائل شود.

```typescript
try {
    compileExpression('$user.name');
} catch (e) {
    // آیا این syntax error است یا security error؟
    // فقط می‌توانیم e.message را بررسی کنیم!
}
```

---

## ۲. پیشنهادات بهبود (Improvements)

### I-1: افزودن Expression Complexity Scoring

می‌توان یک تابع `scoreComplexity(expr: string): number` اضافه کرد که تخمینی از پیچیدگی محاسباتی expression را برمی‌گرداند. این به directive processorها کمک می‌کند expressions ساده (مثل `$user.name`) را از complex (مثل `$items.filter(x => x.active).map(x => x.name).join(', ')`) تشخیص دهند و استراتژی caching بهتری انتخاب کنند.

```typescript
// مثال خروجی:
// "$user.name" → 1
// "$items.length > 0" → 3
// "$items.filter(x => x.active)" → 8
```

---

### I-2: قابل تنظیم کردن `MAX_CACHE_SIZE`

در حال حاضر `MAX_CACHE_SIZE = 500` سخت‌کد شده است. برای برنامه‌های بزرگ با هزاران template binding، کاربر باید بتواند این مقدار را تنظیم کند:

```typescript
export function configureCache(options: { maxSize?: number }): void {
    if (options.maxSize !== undefined) MAX_CACHE_SIZE = options.maxSize;
}
```

---

### I-3: افزودن Cache Metrics

علاوه بر `getCacheSize()`، می‌توان metrics بیشتری اضافه کرد:

```typescript
export function getCacheStats() {
    return {
        size: cache.size,
        maxSize: MAX_CACHE_SIZE,
        hits: cacheHits,
        misses: cacheMisses,
        hitRatio: cacheHits / (cacheHits + cacheMisses),
    };
}
```

این metrics در حال حاضر در `@zenith/devtools` به‌صورت جداگانه ردیابی می‌شوند.

---

### I-4: پشتیبانی از عملگر `**` (Exponentiation)

جاوااسکریپت از `**` به‌عنوان عملگر توان پشتیبانی می‌کند (`2 ** 3 = 8`). می‌توان آن را به `PUNCTUATORS` و `parseUnary` یا سطح مناسب اضافه کرد:

```typescript
// در lexer:
const PUNCTUATORS = [..., '**', ...];
// سطح جدید در parser: parseExponentiation (بین Unary و Multiplicative)
```

---

### I-5: بهبود Error Reporting با Source Location

خطاهای فعلی شامل position هستند اما نه context اطراف آن position. می‌توان با snippet context خطا را بهبود داد:

```
Syntax Error at position 12: expected ')' but got '}'
کد:  $user.age > 18 ? "adult" : {minors"
                                    ^
```

---

### I-6: پشتیبانی از Spread Operator در Array و Object Literals

```typescript
// در Array:
[...$items, $newItem]
// در Object:
{ ...$defaults, name: $user.name }
```

این نیازمند تغییر در `parseArrayExpression` و `parseObjectExpression` است.

---

### I-7: افزودن Static Type Inference

می‌توان یک `inferType(ast: ASTNode): string` نوشت که نوع خروجی expression را از AST استنتاج کند:

```typescript
inferType(compile('$user.age > 18'))     // → 'boolean'
inferType(compile('$user.name'))          // → 'string'
inferType(compile('$items.length'))       // → 'number'
inferType(compile('cond ? a : b'))        // → 'any'
```

این برای VSCode extension و hover hints مفید است.

---

### I-8: پشتیبانی از Async Evaluation

در حال حاضر `evaluate` سنکرون است. اما بعضی کاربردها (مثل `zen-fetch`) نیاز به ارزیابی ناهمگام دارند. می‌توان یک `evaluateAsync` اضافه کرد که توابع async در context را پشتیبانی کند.

---

### I-9: Stack-safe Parser Mode (Iterative Descent)

با وجود depth guard، recursive descent parser همچنان محدودیت recursion depth 200 دارد. در محیط‌هایی با stack size محدود (مثل Cloudflare Workers)، می‌توان یک حالت iterative با stack صریح اضافه کرد.

---

### I-10: بنچمارک عملکرد در Hot Path

با توجه به اینکه `evaluate()` در hot path هر اثر (effect) در فریم‌ورک قرار دارد، افزودن بنچمارک‌های performance برای:

- زمان lex + parse اولین بار
- زمان evaluate برای AST کش‌شده
- حافظه‌ی AST
- نرخ hit ratio در LRU cache

می‌تواند به بهینه‌سازی‌های آینده کمک کند.

```bash
# ساختار پیشنهادی برای benchmark:
benchmarks/
  lexer-perf.ts
  parser-perf.ts
  evaluator-perf.ts
  cache-perf.ts
```

---

## ۳. نکات یکپارچه‌سازی (Integration Notes)

### ارتباط با سایر پکیج‌ها

| پکیج | نوع وابستگی | نحوه‌ی استفاده |
|------|------------|---------------|
| `@zenith/state` | devDependency | برای تست signalها در expressions |
| `@zenith/errors` | dependency | `variableNotDefinedError` و `securityError` در evaluator |
| `@zenith/compiler` | consumer | از `compileExpression` برای compile-time validation استفاده می‌کند |
| `@zenith/runtime` | consumer | از `evaluateExpression` در directive processorها استفاده می‌کند |
| `@zenith/security` | — | `sanitizeHTML` در expressions استفاده نمی‌شود |
| `@zenith/form` | consumer | از `evaluateExpression` برای validation rules استفاده می‌کند |

### معماری داخلی

```
Expression (string)
    │
    ▼
┌──────────┐
│   lexer   │ → Token[]
└──────────┘
    │
    ▼
┌──────────┐
│  parser   │ → ASTNode
└──────────┘
    │
    ▼
┌────────────┐
│ validator  │ → void (throws if unsafe)
└────────────┘
    │
    ▼
┌──────────┐
│  cache    │ → Map<expression, ASTNode> (LRU, max 500)
└──────────┘
    │
    ▼ (هر بار که effect اجرا می‌شود)
┌────────────┐
│ evaluator  │ → any (result)
└────────────┘
```

### امنیت (Defense in Depth)

۱. **Validator (compile-time):** Identifiers ممنوعه و MemberExpressionهای خطرناک را بلاک می‌کند  
۲. **Runtime Guard (evaluate-time):** Property access داینامیک (مثل `$obj[$key]` با `$key='constructor'`) را بلاک می‌کند  
۳. **No eval() / new Function():** تمام محاسبات با switch روی AST node types  
۴. **Depth Guard:** جلوگیری از stack overflow با MAX_DEPTH=200  
۵. **FORBIDDEN_PROPERTIES مشترک:** یک منبع واحد (`security-constants.ts`) برای validator و evaluator  

---

## ۴. امتیاز کلی (Score)

| معیار | امتیاز | توضیح |
|-------|--------|--------|
| **صحت عملکرد** | ۸/۱۰ | template literal string coercion مشکل دارد |
| **امنیت** | ۹/۱۰ | دفاع عمقی خوب، اما security error type مشخص نیست |
| **عملکرد** | ۹/۱۰ | LRU cache, AST-based, بدون eval — بسیار خوب |
| **کامل بودن syntax** | ۷/۱۰ | فاقد `true`/`false`/`null`/`undefined`/`**`/`+unary` |
| **قابلیت نگهداری** | ۹/۱۰ | کد فوق‌العاده تمیز با کامنت‌های فارسی عالی |
| **مستندات** | ۹/۱۰ | README جامع، docstrings دقیق، diagrams معماری |

> **امتیاز نهایی: ۸.۵/۱۰**

---

## ۵. جمع‌بندی

پکیج `@zenith/expressions` یکی از باکیفیت‌ترین و بالغ‌ترین پکیج‌های فریم‌ورک Zenith است. معماری ۴ لایه (Lexer → Parser → Validator → Evaluator) با Cache هوشمند طراحی شده است. امنیت با Defense in Depth تضمین شده و documentation از بهترین‌هاست.

**مهم‌ترین مشکلات:**

1. **متوسط (B-1):** Template literal `${a}${b}` در صورت عدد بودن مقادیر، نتیجه‌ی اشتباه (جمع عددی) برمی‌گرداند
2. **متوسط (B-2):** `true`/`false`/`null`/`undefined` به‌عنوان Literal پشتیبانی نمی‌شوند
3. **جزئی (B-3):** استفاده از `substr` منسوخ‌شده
4. **جزئی (B-4):** `?.[]` (optional computed access) پشتیبانی نمی‌شود
5. **جزئی (B-10):** همه‌ی خطاها از نوع `Error` هستند و قابل تشخیص نیستند

**نقاط قوت:**
- ✅ امنیت بالا — ۵ لایه‌ی دفاعی
- ✅ LRU Cache با eviction
- ✅ کد بسیار تمیز و مستند
- ✅ بدون `eval()` و `new Function()`
- ✅ پشتیبانی از Arrow Functions, Template Literals, Object/Array Expressions
- ✅ فایل `security-constants.ts` مشترک — جلوگیری از drift بین validator و evaluator
