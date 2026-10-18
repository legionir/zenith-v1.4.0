import { computed, type Signal } from '@zenith/state';
import type { DataTableApi, DataTableVirtualWindow } from './types';
/** Resolved layout numbers; shared by windowing and rendering. @internal */
export interface TableVirtualConfig { enabled: boolean; rowHeight: number; overscan: number; viewportHeight: number; }
/** Keep window allocation in the engine's original construction order. @internal */
export function createTableVirtualWindow<T>(input: Pick<DataTableApi<T>, 'filteredData' | 'pageData'> & { virtualCfg: TableVirtualConfig; scrollTopSignal: Signal<number> }) {
  const { filteredData, pageData, virtualCfg, scrollTopSignal } = input;
  const virtualWindow = computed<DataTableVirtualWindow<T>>(() => {
    const rows = filteredData.get();
    const total = rows.length;
    const rh = Math.max(1, virtualCfg.rowHeight);
    const totalHeight = total * rh;
    if (!virtualCfg.enabled) {
      const pageRows = pageData.get();
      return {
        startIndex: 0,
        endIndex: pageRows.length,
        offsetTop: 0,
        totalHeight: pageRows.length * rh,
        visibleRows: pageRows,
      };
    }
    const st = Math.max(0, scrollTopSignal.get());
    const visibleCount = Math.ceil(virtualCfg.viewportHeight / rh);
    const startIndex = Math.max(0, Math.floor(st / rh) - virtualCfg.overscan);
    const endIndex = Math.min(total, Math.floor(st / rh) + visibleCount + virtualCfg.overscan);
    return {
      startIndex,
      endIndex,
      offsetTop: startIndex * rh,
      totalHeight,
      visibleRows: rows.slice(startIndex, endIndex),
    };
  });
  return virtualWindow;
}
