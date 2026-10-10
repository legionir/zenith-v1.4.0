// #144 — معیار پذیرش: «هیچ پیاده‌سازی cache مستقل دیگری در src پکیج‌ها
// نمانده است» و «مهاجرت شش مصرف‌کننده با حفظ API».
// این فایل متن src مصرف‌کننده‌ها را اسکن می‌کند؛ regexها طوری انتخاب شده
// که patternهای «Map + eviction/TTL دستی» را بگیرند و رجیستری‌های بی‌ربط
// (pendingRequests، tagIndex و…) را خراب نکنند.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const CONSUMERS: Record<string, string> = {
  expressions: 'packages/expressions/src/cache.ts',
  http: 'packages/http/src/http.ts',
  data: 'packages/data/src/fetcher.ts',
  resource: 'packages/resource/src/resource.ts',
  components: 'packages/components/src/async-loader.ts',
  router: 'packages/router/src/outlet.ts',
};

function src(pkg: string): string {
  const p = join(ROOT, CONSUMERS[pkg]!);
  expect(existsSync(p), CONSUMERS[pkg]).toBe(true);
  return readFileSync(p, 'utf8');
}

describe('consumer migration (#144)', () => {
  for (const pkg of Object.keys(CONSUMERS)) {
    it(`${pkg}: imports @zenith/cache`, () => {
      expect(src(pkg)).toMatch(/from '@zenith\/cache'/);
    });
  }

  it('no independent Map-based cache stores remain in migrated files', () => {
    // الگوهای قدیمی: `new Map<...Entry>` به‌عنوان مخزن کش یا timestamp دستی.
    const patterns: RegExp[] = [
      /new Map<[^>]*(?:CacheEntry|Entry)[^>]*>\(\)/, // Map<string, CacheEntry>()
      /new LRUCache\b/, // کلاس LRU دستی router
      /class LRUCache\b/,
    ];
    for (const pkg of Object.keys(CONSUMERS)) {
      const text = src(pkg);
      for (const re of patterns) {
        expect(re.test(text), `${pkg} still matches ${re}`).toBe(false);
      }
    }
  });

  it('expressions keeps its public stats shape (acceptance: حفظ شکل آمار)', () => {
    const text = src('expressions');
    // getCacheStats باید همان پنج فیلد را export-form return کند.
    for (const field of ['size', 'maxSize', 'hits', 'misses', 'hitRatio']) {
      expect(new RegExp(`\\b${field}\\b`).test(text), field).toBe(true);
    }
  });

  it('http: unique clear name + deprecated alias (کار #3 — نام‌های تکراری)', () => {
    const text = src('http');
    expect(text).toMatch(/export function clearHttpCache/);
    expect(text).toMatch(/export function clearCache/); // alias no-breaking
    expect(text).toMatch(/deprecate\(/);
  });

  it('each consumer package.json declares the @zenith/cache dependency', () => {
    for (const pkg of Object.keys(CONSUMERS)) {
      const pkgJson = JSON.parse(
        readFileSync(join(ROOT, 'packages', pkg, 'package.json'), 'utf8'),
      ) as { dependencies?: Record<string, string> };
      expect(pkgJson.dependencies?.['@zenith/cache'], pkg).toBe('1.5.0');
    }
  });
});
