// Real per-entry platforms; adding a subpath called "browser" does not make it
// the umbrella's special global bundle. No code executes while reading metadata.
const LEGACY_NODE_HOSTS = new Set(['cli', 'ssr', 'vite-plugin']);
const TARGETS = new Set(['node', 'browser', 'universal', 'worker']);

export function buildPlatform(manifest, entry = '.', directory = '') {
  const override = manifest.zenith?.entryTargets?.[entry];
  const target = override ?? manifest.zenith?.target ?? 'universal';
  if (!TARGETS.has(target)) throw new Error(`Unsupported build target ${String(target)} for ${manifest.name ?? directory}${entry}`);
  if (target === 'node' || (override === undefined && LEGACY_NODE_HOSTS.has(directory))) return 'node';
  return ['browser', 'worker'].includes(target) ? 'browser' : 'neutral';
}

export function needsBrowserGlobal(manifest, entry) {
  return manifest.name === 'zenith' && entry === './browser';
}
