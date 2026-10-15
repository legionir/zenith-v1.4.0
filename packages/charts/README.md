# @zenith/charts

نمودارهای SVG واکنشی (ایشوی `#169` — لایهٔ L2).

## API

| نماد | توضیح |
|---|---|
| `createChart(el, options)` | نمودار واکنشی با `update(data)`، `resize()`، `toImage()`، `dispose()` |
| `renderChartSvg(options, data)` | رندر SVG ایستا (SSR/client یکسان) |
| `chartOptionsSchema` | از `@zenith/schema` برای اعتبارسنجی options |

## انواع

`line`, `area`, `bar`, `pie`, `scatter` — همهٔ آن‌ها بدون کتابخانهٔ بیرونی رندر می‌شوند.

## دایرکتیو

| attribute | رفتار |
|---|---|
| `zen-chart="dataKey"` | bind data به state |
| `zen-chart-type="line|area|bar|pie|scatter"` | نوع نمودار (پیش‌فرض line) |
| `zen-chart-x="col"`, `zen-chart-y="col1,col2"` | کلیدهای ستونی |
| `zen-chart-height="300"`, `zen-chart-width="480"` | ابعاد |
| `zen-chart-legend="false"` | خاموش کردن legend |
| `zen-chart-aria-label=".."` | عنوان برای screen reader |
| `zen-chart-options='{"series":[..]}'` | گزینه‌های اضافه به‌صورت JSON |

## دسترس‌پذیری

- SVG با `role="img"` + `aria-label`
- جدول متنی جایگزین (`zen-chart-a11y`) برای screen reader (پیش‌فرض روشن)
- tooltip بومی با `<title>` داخل هر point

## reduced-motion

انیمیشن فقط وقتی فعال است که `prefers-reduced-motion` فعال نباشد.
