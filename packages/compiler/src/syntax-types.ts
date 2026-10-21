/** Private analyzed HTML directive operands. @internal */
export interface DirectiveInfo { name: string; value: string; raw: string; }
/** @internal */
export interface ElementInfo {
  /** tagName. */
  tag: string;
  /** attribute های دایرکتیو. */
  directives: Array<{ name: string; value: string; raw: string }>;
  /** attribute های static. */
  staticAttrs: Array<{ name: string; value: string }>;
  /** متن static داخل عنصر. */
  staticText: string | null;
  /** آیا فرزندان دارد؟ */
  hasChildren: boolean;
}
