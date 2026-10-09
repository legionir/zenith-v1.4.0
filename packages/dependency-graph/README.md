# @zenith/dependency-graph

استخراجگر گراف وابستگی (فاز ۱۲) — عبارت‌های قالب را parse می‌کند و signal‌های مصرفی هر directive/effect را بیرون می‌کشد؛ برای بهینه‌سازی، devtools و `@zenith/compiler` استفاده می‌شود.

## نصب

```bash
npm install @zenith/dependency-graph
```

## استفاده

```typescript
import { extractDependencies, buildDependencyGraph } from '@zenith/dependency-graph';

const deps = extractDependencies('$user.name + "!"');
// [{ signal: 'user.name', ... }]
const graph = buildDependencyGraph([
  { id: 'el-1', deps: extractDependencies('$count * 2') },
]);
```

## مستندات مرتبط

- [ARCHITECTURE.md §۲](../../ARCHITECTURE.md)
- [README ریشه](../../README.md)

## مجوز

MIT
