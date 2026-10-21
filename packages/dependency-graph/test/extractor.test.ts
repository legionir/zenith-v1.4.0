import { describe, it, expect } from 'vitest';
import {
  extractDependencies,
  extractAllDependencies,
  buildDependencyGraph,
  hasOverlap,
} from '../src/index';

describe('@zenith/dependency-graph extractor (#12 / BUG-6)', () => {
  it('extracts signal dependencies with nested paths and computed bracket access', () => {
    const deps = extractDependencies("$user.profile.email + ' ' + $count + $items[$idx]");
    expect(deps).toEqual([
      { signal: 'user', path: ['profile'], computed: false },
      { signal: 'count', path: [], computed: false },
      { signal: 'items', path: ['*'], computed: true },
      { signal: 'idx', path: [], computed: false },
    ]);

    const all = extractAllDependencies(['$a.x', '$b.y']);
    expect(all.map((d) => d.signal)).toEqual(['a', 'b']);

    const graph = buildDependencyGraph({
      d1: '$user.email',
      d2: '$count + 1',
    });
    expect(graph.d1[0].signal).toBe('user');
    expect(graph.d2[0].signal).toBe('count');

    expect(
      hasOverlap(
        [{ signal: 'user', path: ['profile'], computed: false }],
        [{ signal: 'user', path: ['profile'], computed: false }],
      ),
    ).toBe(true);
  });
});
