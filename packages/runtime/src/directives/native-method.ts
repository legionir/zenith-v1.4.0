/** Native invocation of an unknown legacy model/map capability, not a decoder. @internal */
export function callModelMethod(target: unknown, methodName: string, args: unknown[]): unknown {
  if (target === null || target === undefined) throw new TypeError(`Cannot call ${methodName} on a nullish model target`);
  const method: unknown = Reflect.get(Object(target), methodName);
  if (typeof method !== 'function') throw new TypeError(`Model target ${methodName} is not callable`);
  return Reflect.apply(method, target, args);
}
