# گزارش حسابرسی پکیج `dependency-graph`
**نسخه:** v1.3.0 | **بسته:** `@zenith/dependency-graph`

---

## ۱. خلاصه پکیج

پکیج `dependency-graph` یک ابزار برای استخراج و تحلیل وابستگی‌های بین ماژول‌ها در فریم‌ورک Zenith است. توابع `extractDependencies`, `extractAllDependencies`, `buildDependencyGraph`, `hasOverlap` را ارائه می‌دهد.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/extractor.ts` | ~۱۰۰+ | توابع استخراج و تحلیل وابستگی‌ها |
| `src/index.ts` | ~۱۰ | re-export |

---

## ۳. باگ‌ها و مشکلات

### BUG-DEP-01: `hasOverlap` ممکن است برای dependency cycles loop کند
- **شدت:** کم
- **محل:** `src/extractor.ts`
- **شرح:** اگر دو dependency graph دارای circular dependency باشند، `hasOverlap` ممکن است وارد یک loop تکراری شود یا stack overflow کند. (تأیید نیاز به خواندن دقیق کد)
- **نحوه رفع:** افزودن visited Set:

```typescript
export function hasOverlap(
  graphA: DependencyGraph,
  graphB: DependencyGraph,
): boolean {
  const visited = new Set<string>();
  const check = (node: string): boolean => {
    if (visited.has(node)) return false;
    visited.add(node);
    return (graphA[node] && graphB[node]) ||
      (graphA[node]?.dependencies?.some(check) ?? false) ||
      (graphB[node]?.dependencies?.some(check) ?? false);
  };
  return Object.keys({ ...graphA, ...graphB }).some(check);
}
```

### BUG-DEP-02: `extractDependencies` از regex برای import detection استفاده می‌کند
- **شدت:** کم
- **محل:** `src/extractor.ts`
- **شرح:** استخراج وابستگی‌ها با regex ساده انجام می‌شود. Importهای پیچیده (dynamic imports, re-exports) ممکن است به درستی شناسایی نشوند.
- **نحوه رفع:** استفاده از parser واقعی:

```typescript
import { parse } from '@babel/parser';

export function extractDependencies(source: string): string[] {
  const deps: string[] = [];
  try {
    const ast = parse(source, { sourceType: 'module' });
    // استخراج import declarations از AST
  } catch {
    // Fallback به regex
    return extractDependenciesRegex(source);
  }
  return deps;
}
```

---

## ۴. نتیجه‌گیری کلی

پکیج `dependency-graph` یک ابزار ساده و کاربردی است. regex-based detection محدودیت دارد اما برای اکثر موارد کافی است.

**امتیاز کلی: ۶/۱۰** (ساده و قابل استفاده، محدودیت در تشخیص imports پیچیده)
