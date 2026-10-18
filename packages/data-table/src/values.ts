/** Native dynamic table values; not response decoding. @internal */
export function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => value == null ? undefined : Reflect.get(Object(value), key), obj);
}

export function setNestedValue(obj: object, input: { path: string; value: unknown }): void {
  const { path, value } = input;
  const read = (target: unknown, key: string): unknown => Reflect.get(Object(target), key);
  const write = (target: unknown, key: string, next: unknown): void => {
    if ((typeof target !== 'object' || target === null) && typeof target !== 'function') throw new TypeError('Cannot assign an editor path on a primitive value.');
    if (!Reflect.set(target, key, next)) throw new TypeError(`Cannot assign editor property ${key}.`);
  };
  const keys = path.split('.');
  let current: unknown = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    if (!read(current, key)) write(current, key, {});
    current = read(current, key);
  }
  const lastKey = keys[keys.length - 1];
  if (lastKey) write(current, lastKey, value);
}

export function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

export function downloadFile(content: string, options: { filename: string; type: string }) {
  const { filename, type } = options;
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
