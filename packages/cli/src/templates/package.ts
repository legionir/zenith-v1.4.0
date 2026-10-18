import { dependencyVersion } from './versions';
/** Package-manager-independent ranges; never emit workspace: outside the monorepo. */
export function packageJsonTemplate(projectName: string): string {
  return JSON.stringify({ name: projectName.toLowerCase(), version: '0.1.0', private: true, type: 'module', engines: { node: '^20.19.0 || >=22.12.0' },
    scripts: { dev: 'vite --host 0.0.0.0', build: 'tsc --noEmit && vite build', preview: 'vite preview --host 0.0.0.0', test: 'vitest run' },
    dependencies: Object.fromEntries(['@zenith/state', '@zenith/runtime', '@zenith/logger'].map(name => [name, dependencyVersion(name)])),
    devDependencies: { '@zenith/vite-plugin': dependencyVersion('@zenith/vite-plugin'), vite: '^6.4.4', typescript: '^5.4.0', vitest: '^4.1.11' },
  }, null, 2) + '\n';
}
