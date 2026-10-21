/** Stable legacy request-key serialization. @internal */
function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const input = value as Record<string, unknown>; const output = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(input).sort()) output[key] = canonicalize(input[key]);
  return output;
}
/** Internal request-key operands. @internal */
export interface CacheKeyInput { method: string; url: string; body?: unknown; }
/** Keep the historical canonicalization and missing-body distinction. @internal */
export function createCacheKey({ method, url, body }: CacheKeyInput): string {
  return `${method}:${url}:${body === undefined ? '' : JSON.stringify(canonicalize(body))}`;
}

