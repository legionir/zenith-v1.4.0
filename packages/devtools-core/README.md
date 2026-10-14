# @zenith/devtools-core

هستهٔ یکپارچهٔ L1 برای ابزارهای توسعهٔ Zenith (SPEC §۲.۷ / `#147`).

چرخهٔ `state ↔ devtools` را می‌شکند و دو رجیستری موازی پیشین (`state/registry.ts` و `devtools/api.ts`) را در یک رجیستری با شناسهٔ رشته‌ای واحد، Timeline، Time-travel (`snapshot`/`restore`/`replay`)، گراف زمان اجرا (`RuntimeGraph`) و رجیستری پنل (`registerCache`/`registerStore`/`registerApp`) یکی می‌کند.

## نصب و راه‌اندازی

```ts
import {
  installDevtoolsCore,
  getAllSignals,
  getTimeline,
  snapshot,
  restore,
} from '@zenith/devtools-core';

const devtools = installDevtoolsCore({ maxTimelineEntries: 1000 });
// در پایان چرخهٔ عمر:
devtools.dispose();
```
