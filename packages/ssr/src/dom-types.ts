/** Document markers belong to one render lifetime and are restored in finally. @public */
export interface SSRDocument extends Document { __zenithSSR__?: boolean; __zenithSSRRequest__?: object; }
/** Minimal host DOM capability, independent of a particular optional DOM implementation. @public */
export interface SSRDOMWindow {
  document: SSRDocument;
  Node?: typeof Node; HTMLElement?: typeof HTMLElement; Element?: typeof Element;
  Event?: typeof Event; DOMParser?: typeof DOMParser; MouseEvent?: typeof MouseEvent; KeyboardEvent?: typeof KeyboardEvent;
  history?: History; location?: Location;
  close?(): void;
}
/** Host factory owns the close callback; each render receives an exclusive instance. @public */
export interface SSRDOMInstance { window: SSRDOMWindow; close?(): void; }
