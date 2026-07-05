# @zenith/expressions

موتور Expressions فریم‌ورک Zenith — یک کامپایلر کوچک و **ایمن** برای ارزیابی عبارات Template.

## چرا این پکیج مهم است؟

در فریم‌ورک‌های مدرن، شما عباراتی مثل `$user.name + ' ' + $user.age` را در HTML می‌نویسید و فریم‌ورک آن‌ها را ارزیابی می‌کند. دو راه برای این کار وجود دارد:

| روش | مشکل |
|---|---|
| `eval()` / `new Function()` | ⚠️ **خطرناک** (XSS، Code Injection) + کند + غیرقابل Cache |
| **AST-based (این پکیج)** | ✅ ایمن + سریع + قابل Cache + قابل Static Analysis |

## ویژگی‌ها

- ✅ **بدون `eval()`** — کاملاً بر اساس AST
- ✅ **Caching** — هر Expression فقط یک‌بار Parse می‌شود (LRU)
- ✅ **Security Validation** — بلاک کردن `window`, `eval`, `constructor`, `__proto__`
- ✅ **پشتیبانی از**: عملگرهای ریاضی، منطقی، مقایسه‌ای، سه‌تایی، دسترسی به پراپرتی، فراخوانی تابع
- ✅ **Type-safe** — کاملاً با TypeScript

## نصب

```bash
npm install @zenith/expressions
```

## استفاده

### API ساده (اکثر موارد)

```typescript
import { evaluateExpression } from '@zenith/expressions';

const context = {
  $user: { name: 'Ali', age: 25 },
  $currency: { format: (val) => `$${val.toFixed(2)}` },
};

evaluateExpression('$user.name', context);                  // 'Ali'
evaluateExpression('$user.age > 18', context);             // true
evaluateExpression('$currency.format(100)', context);      // '$100.00'
evaluateExpression('$user.age > 18 ? "adult" : "minor"', context); // 'adult'
```

### API پیشرفته (برای Performance)

```typescript
import { compile, evaluate } from '@zenith/expressions';

// یک‌بار کامپایل (parse + validate + cache)
const ast = compile('$user.name + " " + $user.age');

// چندین بار evaluate (بدون Parse مجدد)
const v1 = evaluate(ast, ctx1);
const v2 = evaluate(ast, ctx2);
const v3 = evaluate(ast, ctx3);
```

## سینتکس پشتیبانی‌شده

| نوع | مثال |
|---|---|
| Number | `42`, `3.14` |
| String | `"hello"`, `'world'`, با escape: `"a\nb"` |
| Identifier | `$user`, `count`, `_private` |
| Member Access | `$user.name`, `$arr[0]`, `$obj["key"]` |
| Function Call | `$fn(a, b)`, `$obj.method(x)` (با `this` صحیح) |
| عملگرهای ریاضی | `+`, `-`, `*`, `/`, `%` |
| عملگرهای مقایسه | `==`, `===`, `!=`, `!==`, `<`, `>`, `<=`, `>=` |
| عملگرهای منطقی | `&&`, `||`, `!` |
| عملگر یکانی | `-x`, `!flag` |
| عملگر سه‌تایی | `cond ? a : b` |
| گروه‌بندی | `(a + b) * c` |

## تست

```bash
npm test
```

## مجوز

MIT
