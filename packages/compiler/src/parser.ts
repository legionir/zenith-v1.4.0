/** Environment selection and lazy per-parser import ownership. @internal */
export function createParser(): (html: string) => Document | Promise<Document> {
  if (typeof DOMParser !== 'undefined') {
    return (html: string) => new DOMParser().parseFromString(html, 'text/html');
  }

  // در Node، JSDOM را lazy dynamic import کن.
  // از dynamic import استفاده می‌کنیم نه require() چون این پکیج ESM است.
  let JSDOMCtor: typeof import('jsdom').JSDOM | null = null;
  let jsdomPromise: Promise<void> | null = null;

  const asyncParser = async (html: string) => {
    if (!JSDOMCtor) {
      if (!jsdomPromise) {
        jsdomPromise = import('jsdom')
          .then((mod) => {
            JSDOMCtor = mod.JSDOM || (mod as { default?: { JSDOM?: typeof mod.JSDOM } }).default?.JSDOM || null;
          })
          .catch(() => {
            throw new Error(
              '[Zenith Compiler] DOMParser or jsdom is required. Install jsdom: npm install jsdom',
            );
          });
      }
      await jsdomPromise;
    }
    const dom = new JSDOMCtor!(html);
    return dom.window.document;
  };
  return asyncParser;
}
