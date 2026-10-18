/** Decode only the error shape actually consumed by the legacy Zod adapter. @internal */
export function schemaFieldError(error: unknown, name: string): string | undefined {
  if (!error || typeof error !== 'object' || !('errors' in error) || !Array.isArray(error.errors)) return undefined;
  for (const candidate of error.errors as unknown[]) {
    if (!candidate || typeof candidate !== 'object' || !('path' in candidate) || !Array.isArray(candidate.path) || candidate.path[0] !== name) continue;
    return 'message' in candidate && typeof candidate.message === 'string' && candidate.message ? candidate.message : 'Invalid value';
  }
  return undefined;
}
