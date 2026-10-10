// packages/cache/src/attr.ts
//
// #144 — گرامر attribute کش (SPEC §۲.۴ + §۰.۳):
//   zen-<name>-cache="30s" | "30s,swr=2m" | "never" | "false" | "30s,tag=users,v2"
// توکن location (بدون «=») باید نخست باشد؛ «tag=a,b» لیست را با توکن‌های
// bare بعدی ادامه می‌دهد. واحد زمان از shared.parseDuration (گرامر §۰.۲).
// ورودی نامعتبر ⇒ { ttl: NaN }؛ پرتاب خطا وظیفهٔ directive است (UI owner).
import { parseDuration } from '@zenith/shared';
import type { CachePolicy } from './types';

export function parseCacheAttr(value: string): CachePolicy {
  let ttl: number | 'never' = 'never';
  let swr: number | undefined;
  let tags: string[] | undefined;
  let sawLocation = false;
  let sawAny = false;

  for (const raw of value.split(',')) {
    const token = raw.trim();
    if (token === '') continue;
    const eq = token.indexOf('=');

    if (eq < 0) {
      // توکن bare: فقط location (نخست) یا ادامهٔ لیست tag (tag=a,b)
      const lower = token.toLowerCase();
      if (tags !== undefined && sawLocation) {
        tags.push(token);
        continue;
      }
      if (sawAny || sawLocation) return { ttl: Number.NaN };
      if (lower === 'false') return { disabled: true };
      if (lower === 'never') {
        ttl = 'never';
        sawLocation = true;
        sawAny = true;
        continue;
      }
      const d = parseDuration(token);
      if (d === 'never' || Number.isNaN(d)) return { ttl: Number.NaN };
      ttl = d;
      sawLocation = true;
      sawAny = true;
      continue;
    }

    const key = token.slice(0, eq).trim().toLowerCase();
    const val = token.slice(eq + 1).trim();
    sawAny = true;
    if (key === 'swr') {
      const d = parseDuration(val);
      if (d === 'never' || Number.isNaN(d)) return { ttl: Number.NaN };
      if (swr !== undefined) return { ttl: Number.NaN }; // تکرار
      swr = d;
      continue;
    }
    if (key === 'tag') {
      if (val === '') return { ttl: Number.NaN };
      tags = (tags ?? []).concat(
        val
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t !== ''),
      );
      continue;
    }
    return { ttl: Number.NaN }; // کلید ناشناخته
  }

  if (!sawAny) return { ttl: Number.NaN }; // ورودی خالی/فقط کاما
  const policy: CachePolicy = { ttl };
  if (swr !== undefined) policy.staleWhileRevalidate = swr;
  if (tags !== undefined) policy.tags = tags;
  return policy;
}
