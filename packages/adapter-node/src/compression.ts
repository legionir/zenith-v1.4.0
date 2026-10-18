/** @public */
export type Compression = boolean | 'gzip' | 'br';
/** false means no supported representation satisfies Accept-Encoding. */
export function encodingFor(header: string | undefined, option: Compression = true): 'gzip' | 'br' | undefined | false {
  if (!header) return undefined;
  const weights = new Map<string, number>();
  for (const entry of header.split(',')) {
    const [token, ...parameters] = entry.trim().toLowerCase().split(';'); if (!token) continue;
    let weight = 1;
    for (const parameter of parameters) {
      const [name, value] = parameter.trim().split('=');
      if (name === 'q') weight = value && /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(value) ? Number(value) : 0;
    }
    weights.set(token, Math.max(weights.get(token) ?? 0, weight));
  }
  const identity = weights.get('identity') ?? (weights.get('*') === 0 ? 0 : 1);
  const candidates = (option === true ? ['br', 'gzip'] : option === false ? [] : [option]) as Array<'br' | 'gzip'>;
  let selected: 'br' | 'gzip' | undefined, weight = 0;
  for (const candidate of candidates) { const q = weights.get(candidate) ?? weights.get('*') ?? 0; if (q > weight) { weight = q; selected = candidate; } }
  // An explicit identity preference beats a less preferred compressed format.
  if (weights.has('identity') && identity > weight) return undefined;
  return selected ?? (identity > 0 ? undefined : false);
}
