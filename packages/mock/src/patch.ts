import type { Cleanup } from '@zenith/shared';
interface PatchScope { original: unknown; descriptor?: PropertyDescriptor; current: unknown; frames: Array<{ value: unknown }>; }
const targets = new WeakMap<object, Map<PropertyKey, PatchScope>>();
function write(object: Record<PropertyKey, unknown>, key: PropertyKey, value: unknown): void {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor?.configurable) Object.defineProperty(object, key, { configurable: true, enumerable: descriptor.enumerable, writable: true, value });
  else object[key] = value;
  if (object[key] !== value) throw new TypeError('Mock target cannot be patched.');
}
/** Stack leases restore exact original descriptors even when owners close out of order. @internal */
export function patch(target: object, key: PropertyKey, create: (original: unknown) => unknown): Cleanup {
  const object = target as Record<PropertyKey, unknown>; let scopes = targets.get(target); if (!scopes) { scopes = new Map(); targets.set(target, scopes); }
  let scope = scopes.get(key);
  if (!scope || object[key] !== scope.current) { scope = { original: object[key], descriptor: Object.getOwnPropertyDescriptor(object, key), current: object[key], frames: [] }; scopes.set(key, scope); }
  const frame = { value: create(scope.original) };
  try { write(object, key, frame.value); }
  catch (error) { if (!scope.frames.length && scopes.get(key) === scope) scopes.delete(key); throw error; }
  scope.frames.push(frame); scope.current = frame.value; let active = true;
  return () => {
    if (!active) return; active = false; const index = scope.frames.indexOf(frame); if (index >= 0) scope.frames.splice(index, 1);
    try {
      if (object[key] === scope.current) {
        const top = scope.frames[scope.frames.length - 1];
        if (top) write(object, key, top.value);
        else if (scope.descriptor) Object.defineProperty(object, key, scope.descriptor);
        else delete object[key];
        scope.current = object[key];
      }
    } finally { if (!scope.frames.length && scopes.get(key) === scope) scopes.delete(key); }
  };
}
