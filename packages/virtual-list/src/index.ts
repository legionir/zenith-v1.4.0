/** @public */
export {
  createVirtualList,
  type ScrollAlignment,
  type ScrollInfo,
  type VirtualItem,
  type VirtualItemSize,
  type VirtualListApi,
  type VirtualListDirection,
  type VirtualListOptions,
  type VirtualListState,
} from './controller';

/** @public @deprecated Use `createVirtualList` (ZEN-DEPR-001, removal in 2.0). */
export { processVirtualList } from './virtual-list';
/** @public */
export {
  virtualListConfigToOptions,
  type VirtualListConfig,
  type VirtualRange,
  type VirtualListController,
} from './virtual-list';

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/virtual-list` (`VirtualListOptions`).
 * @default { itemHeight: 40, overscan: 3, direction: 'vertical' }
 * @unit px (itemHeight)
 * @since 1.4.0
 * @public
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  itemHeight: 40,
  overscan: 3,
  direction: 'vertical' as const,
});
