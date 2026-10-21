import { expect, it, vi } from 'vitest';
import { printToHost, setHostPrinter } from '../src/print';
it('supports isolated capture, safe failure and out-of-order disposal', () => {
  const first = vi.fn(); const second = vi.fn();
  const offFirst = setHostPrinter(first); const offSecond = setHostPrinter(second);
  printToHost('warning', 'one'); expect(second).toHaveBeenCalledTimes(1); expect(first).not.toHaveBeenCalled();
  offFirst(); offSecond(); offSecond(); printToHost('warning', 'two'); expect(first).not.toHaveBeenCalled();
  const offBroken = setHostPrinter(() => { throw new Error('sink failure'); });
  expect(() => printToHost('error', 'three')).not.toThrow(); offBroken();
});
