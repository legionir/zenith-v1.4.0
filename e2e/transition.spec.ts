// Real-browser e2e for transition completion (#23) on Chromium.
// Proof that onAfterLeave/finished wait for the LONGEST transition/animation
// (0.5s transform) and ignore events from children (0.05s child animation,
// 0.1s opacity), instead of finishing on the first transitionend.
import { test, expect } from '@playwright/test';

test('leave completes only after the longest transition (0.5s transform)', async ({ page }) => {
  test.skip(process.env.ZENITH_E2E_NO_BROWSER === '1', 'browser opt-out for local unit runs');
  await page.goto('/e2e/transition-fixture.html');
  await page.waitForFunction(() => window.__ZENITH_TRN_READY__ === true);

  const elapsed = await page.evaluate(async () => {
    await window.startLeave('two-props');
    const { startedAt, leaveCompleteAt, classNameAtEnd } = window.__ZENITH_TRN__;
    return { ms: leaveCompleteAt - startedAt, classNameAtEnd };
  });

  // طولانی‌ترین property = ۵۰۰ms؛ پایان نباید قبل از آن باشد (با حاشیه ۸۰ms برای real-timer)
  expect(elapsed.ms).toBeGreaterThanOrEqual(400);
  expect(elapsed.classNameAtEnd).toBe(''); // کلاس‌های موقت پاک شده‌اند
});

test('child animation events do not end the parent transition early', async ({ page }) => {
  test.skip(process.env.ZENITH_E2E_NO_BROWSER === '1', 'browser opt-out for local unit runs');
  await page.goto('/e2e/transition-fixture.html');
  await page.waitForFunction(() => window.__ZENITH_TRN_READY__ === true);

  const result = await page.evaluate(async () => {
    // فرزند یک انیمیشن ۵۰ms دارد که transitionend/animationend را به والد
    // bubble می‌کند؛ والد هیچ transition خودش ندارد → fallback در
    // duration+50=100ms تمام می‌کند و نباید زودتر (مثلاً در ۵۰ms) تمام شود.
    const p = window.startLeave('child-anim');
    await new Promise((r) => setTimeout(r, 60));
    const early = { done: false };
    p.then(() => (early.done = true));
    await new Promise((r) => setTimeout(r, 10));
    const doneAt60 = early.done;
    await p;
    return { doneAt60, ms: performance.now() - window.__ZENITH_TRN__.startedAt };
  });

  expect(result.doneAt60).toBe(false); // قرمز قبل از رفع: event فرزند در ~۵۰ms تمام می‌کرد
  expect(result.ms).toBeGreaterThanOrEqual(90);
});
