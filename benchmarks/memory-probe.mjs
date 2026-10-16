// benchmarks/memory-probe.mjs
// #86 — اندازه‌گیری حافظه در یک فرایند جدا با `--expose-gc`.
//
// چرا جدا؟ `process.memoryUsage().heapUsed` در همان فرایندی که سوئیت را اجرا
// کرده، تحت تأثیر زبالهٔ بنچمارک‌های قبلی و GC خودکار V8 است؛ در عمل delta
// می‌تواند **منفی** شود (اندازه‌گیری‌شده: −۵۱۸۰ بایت). اینجا gc() صریح می‌گیریم،
// heap را پایدار می‌کنیم، ۱۰۰k سیگنال می‌سازیم و دلتا را برمی‌گردانیم.
//
// اجرا: node --expose-gc benchmarks/memory-probe.mjs [count]
const count = Math.max(1, Number(process.argv[2] ?? 100_000));

let state;
try {
  state = await import(new URL('../packages/state/dist/index.js', import.meta.url).href);
} catch {
  state = await import(new URL('../packages/state/src/index.ts', import.meta.url).href);
}

const gc = globalThis.gc;
if (typeof gc === 'function') {
  gc();
  gc();
}

const before = process.memoryUsage().heapUsed;
const keep = new Array(count);
for (let i = 0; i < count; i++) keep[i] = state.signal(i);
const after = process.memoryUsage().heapUsed;

// آرایه را «زنده» نگه می‌داریم (اگر GC شود عدد بی‌معنا می‌شود).
if (keep.length !== count) throw new Error('memory-probe: signals were collected');

process.stdout.write(
  `${JSON.stringify({
    signals: count,
    before,
    after,
    bytesPerSignal: Math.round((after - before) / count),
    gcExposed: typeof gc === 'function',
  })}\n`,
);
