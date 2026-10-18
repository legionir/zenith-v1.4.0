/** Deprecation is lifecycle metadata, never a release/visibility level. */
export const RELEASE_LEVELS = Object.freeze(['public', 'beta', 'alpha', 'experimental', 'internal']);
export function releaseMetadata(tags) {
  const names = new Set(tags.map(tag => typeof tag === 'string' ? tag : tag.name));
  const levels = RELEASE_LEVELS.filter(level => names.has(level));
  return { tag: levels.length === 1 ? levels[0] : levels.length ? 'conflicting' : 'unclassified', deprecated: names.has('deprecated') };
}

/** Callable overloads share visibility, but one legacy overload does not deprecate the canonical API. */
export function mergeDeclarationMetadata(items) {
  if (!items.length) return releaseMetadata([]);
  const levels = new Set(items.map(item => item.tag).filter(tag => RELEASE_LEVELS.includes(tag)));
  const tag = items.some(item => item.tag === 'conflicting') || levels.size > 1 ? 'conflicting' : items.some(item => item.tag === 'unclassified') ? 'unclassified' : [...levels][0] ?? 'unclassified';
  return { tag, deprecated: items.every(item => item.deprecated) };
}

/** Re-export annotations add exposure metadata; they never silently promote internal API. */
export function exposureMetadata(actual, alias) {
  const tags = [actual.tag, alias.tag].filter(tag => RELEASE_LEVELS.includes(tag));
  const combined = releaseMetadata(tags);
  return { tag: actual.tag === 'conflicting' || alias.tag === 'conflicting' ? 'conflicting' : combined.tag, deprecated: actual.deprecated || alias.deprecated };
}
