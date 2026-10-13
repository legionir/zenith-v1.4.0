#!/usr/bin/env node
// #172 — Scaffold tool for new Zenith workspace packages (NEW-PACKAGES-SPEC.md §6).
// Usage:
//   npm run new:package -- <name> --layer <L0|L1|L2|L3|L4|L5|tooling> [--budget "4 kb"] [--no-peers] [--dual]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const VALID_LAYERS = new Set(['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'tooling']);
const UNSCOPED_NAMES = new Set(['zenith', 'create-zenith', 'unplugin-zenith']);
const PEER_LAYERS = new Set(['L1', 'L2', 'L3', 'L4', 'L5']);

const DEFAULT_BUDGET_BY_LAYER = {
  L0: '4 kb',
  L1: '5 kb',
  L2: '8 kb',
  L3: '25 kb',
  L4: '10 kb',
  L5: '15 kb',
  tooling: '15 kb',
};

export const ACCEPTANCE_CHECKLIST_ITEMS = [
  'لایه و وابستگی‌ها مطابق بند ۱؛ `dependency-cruiser` سبز.',
  '`XOptions` با schema و `DEFAULTS`؛ تست «پیش‌فرض‌ها + مقدار نامعتبر».',
  'هر `createX` دارای `dispose()` و تست idempotency/نشت.',
  'هر directive دارای `DirectiveMeta` و ورودی در `zenith.meta.json`.',
  'کدهای خطای بازهٔ خودش در `@zenith/errors` ثبت شده و مستند است.',
  'SSR: تست رندر سرور، hydration بدون mismatch، یا `client-only` صریح.',
  'a11y: axe بدون نقض `serious`+؛ کیبورد کامل برای کامپوننت‌های تعاملی.',
  'بودجهٔ حجم (`size-limit`) و tree-shaking (import یک تابع ⇒ فقط همان).',
  'README (نصب، مثال، جدول گزینه‌ها و attributeها)، TypeDoc، `CHANGELOG`.',
  '`api-extractor` snapshot؛ هیچ export داخلی در `index.ts`.',
  'بدون `console.*`، `throw new Error` ساده، `any` در API عمومی، `Math.random` امنیتی.',
  'تست در Node 18.19/20/22 و مرورگرهای Chromium/Firefox/WebKit.',
];

export function parseScaffoldArgs(argv) {
  let name = '';
  let layer = '';
  let budget = '';
  let description = '';
  let peers = undefined;
  let dual = undefined;
  let unscoped = false;
  let rootDir = process.cwd();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--layer' || arg === '-l') {
      layer = argv[++i] ?? '';
    } else if (arg.startsWith('--layer=')) {
      layer = arg.slice('--layer='.length);
    } else if (arg === '--budget') {
      budget = argv[++i] ?? '';
    } else if (arg.startsWith('--budget=')) {
      budget = arg.slice('--budget='.length);
    } else if (arg === '--description' || arg === '-d') {
      description = argv[++i] ?? '';
    } else if (arg === '--peers') {
      peers = true;
    } else if (arg === '--no-peers') {
      peers = false;
    } else if (arg === '--dual') {
      dual = true;
    } else if (arg === '--esm-only') {
      dual = false;
    } else if (arg === '--unscoped') {
      unscoped = true;
    } else if (arg === '--root') {
      rootDir = resolve(argv[++i] ?? '.');
    } else if (!arg.startsWith('-') && !name) {
      name = arg.replace(/^@zenith\//, '');
    }
  }

  return { name, layer, budget, description, peers, dual, unscoped, rootDir };
}

export function scaffoldPackage(rawOptions) {
  const {
    name,
    layer,
    budget: rawBudget,
    description: rawDesc,
    peers: rawPeers,
    dual: rawDual,
    unscoped = false,
    rootDir = process.cwd(),
    peerVersion,
    updateWorkspaceFiles = true,
  } = rawOptions;

  if (!name || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(
      `Invalid package name "${name ?? ''}". Expected kebab-case (e.g. "devtools-core").`,
    );
  }
  if (!VALID_LAYERS.has(layer)) {
    throw new Error(
      `Invalid --layer "${layer ?? ''}". Expected one of: ${[...VALID_LAYERS].join(', ')}.`,
    );
  }

  const pkgDir = join(rootDir, 'packages', name);
  if (existsSync(pkgDir)) {
    throw new Error(`Package directory already exists: packages/${name}`);
  }

  const isUnscoped = unscoped || UNSCOPED_NAMES.has(name);
  const pkgName = isUnscoped ? name : `@zenith/${name}`;
  const isDual = rawDual ?? layer === 'tooling';
  const hasPeers = rawPeers ?? PEER_LAYERS.has(layer);
  const budget = rawBudget || DEFAULT_BUDGET_BY_LAYER[layer] || '5 kb';

  let resolvedPeerVersion = peerVersion;
  if (!resolvedPeerVersion) {
    const rootPkgPath = join(rootDir, 'package.json');
    if (existsSync(rootPkgPath)) {
      const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
      resolvedPeerVersion = rootPkg.version || '1.4.0';
    } else {
      resolvedPeerVersion = '1.5.0';
    }
  }

  const description = rawDesc || `Zenith framework — ${layer} package (${pkgName}).`;

  const dotExport = {
    types: './dist/index.d.ts',
    development: './dist/index.js',
    import: './dist/index.js',
    ...(isDual ? { require: './dist/index.cjs' } : {}),
  };

  const pkgJson = {
    name: pkgName,
    version: '1.5.0',
    description,
    license: 'MIT',
    type: 'module',
    main: isDual ? './dist/index.cjs' : './dist/index.js',
    module: './dist/index.js',
    types: './dist/index.d.ts',
    sideEffects: false,
    exports: {
      '.': dotExport,
      './package.json': './package.json',
    },
    files: ['dist', 'README.md', 'LICENSE'],
    scripts: {
      build: 'tsc -p tsconfig.json',
      typecheck: 'tsc --noEmit',
    },
    keywords: ['zenith', name, layer.toLowerCase()],
    engines: {
      node: '>=18.19',
    },
    ...(hasPeers
      ? {
          peerDependencies: {
            '@zenith/state': `^${resolvedPeerVersion}`,
            '@zenith/scheduler': `^${resolvedPeerVersion}`,
          },
        }
      : {}),
    repository: {
      type: 'git',
      url: 'git+https://github.com/legionir/zenith-v1.4.0.git',
      directory: `packages/${name}`,
    },
    homepage: 'https://github.com/legionir/zenith-v1.4.0/tree/audit/consolidated-report#readme',
    bugs: {
      url: 'https://github.com/legionir/zenith-v1.4.0/issues',
    },
    publishConfig: {
      access: 'public',
      provenance: true,
    },
    zenithLayer: layer,
  };

  const tsconfig = {
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      outDir: './dist',
      rootDir: './src',
    },
    include: ['src/**/*'],
  };

  const pascal = name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const peerImports = hasPeers
    ? `import type { Signal } from '@zenith/state';\nimport type { SchedulerHooks } from '@zenith/scheduler';\n\nexport type ${pascal}PeerTypes = {\n  readonly signal?: Signal<unknown>;\n  readonly schedulerHooks?: SchedulerHooks;\n};\n\n`
    : '';

  const srcIndex = `/**
 * ${pkgName} (${layer})
 *
 * @packageDocumentation
 */
${peerImports}export interface ${pascal}Options {
  /**
   * Enable or disable ${pkgName}.
   * @default true
   * @since 1.5.0
   */
  readonly enabled?: boolean;
}

export interface ${pascal}Instance {
  readonly options: Readonly<Required<${pascal}Options>>;
  dispose(): void;
}

/**
 * Frozen default options for {@link create${pascal}}.
 */
export const DEFAULTS: Readonly<Required<${pascal}Options>> = Object.freeze({
  enabled: true,
});

/**
 * Create a disposable ${pkgName} instance.
 */
export function create${pascal}(options: ${pascal}Options = {}): ${pascal}Instance {
  const resolved: Readonly<Required<${pascal}Options>> = Object.freeze({
    enabled: options.enabled ?? DEFAULTS.enabled,
  });
  let disposed = false;
  return {
    options: resolved,
    dispose(): void {
      if (disposed) return;
      disposed = true;
    },
  };
}
`;

  const testFile = `import { describe, expect, it } from 'vitest';
import { DEFAULTS, create${pascal} } from '../src/index.js';

describe('${pkgName}', () => {
  it('exposes frozen DEFAULTS and idempotent dispose()', () => {
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
    expect(DEFAULTS.enabled).toBe(true);

    const instance = create${pascal}({ enabled: false });
    expect(instance.options.enabled).toBe(false);
    expect(() => {
      instance.dispose();
      instance.dispose();
    }).not.toThrow();
  });
});
`;

  const checklistMd = ACCEPTANCE_CHECKLIST_ITEMS.map((item) => `- [ ] ${item}`).join('\n');
  const readme = `# \`${pkgName}\`

> ${description}

## Installation

\`\`\`bash
npm install ${pkgName}
\`\`\`

## Usage

\`\`\`ts
import { create${pascal}, DEFAULTS } from '${pkgName}';

const instance = create${pascal}();
instance.dispose();
\`\`\`

## Options (\`DEFAULTS\`)

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| \`enabled\` | \`boolean\` | \`true\` | Enable or disable \`${pkgName}\`. |

## Acceptance Checklist (SPEC §6.2)

${checklistMd}
`;

  const rootLicensePath = join(rootDir, 'LICENSE');
  const licenseText = existsSync(rootLicensePath)
    ? readFileSync(rootLicensePath, 'utf8')
    : 'MIT License\n\nCopyright (c) 2026 Zenith Team\n';

  mkdirSync(join(pkgDir, 'src'), { recursive: true });
  mkdirSync(join(pkgDir, 'test'), { recursive: true });

  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkgJson, null, 2) + '\n');
  writeFileSync(join(pkgDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2) + '\n');
  writeFileSync(join(pkgDir, 'LICENSE'), licenseText);
  writeFileSync(join(pkgDir, 'README.md'), readme);
  writeFileSync(join(pkgDir, 'src', 'index.ts'), srcIndex);
  writeFileSync(join(pkgDir, 'test', `${name}.test.ts`), testFile);

  if (updateWorkspaceFiles) {
    // 1. Update .size-limit.json
    const sizeLimitPath = join(rootDir, '.size-limit.json');
    if (existsSync(sizeLimitPath)) {
      const sizeLimit = JSON.parse(readFileSync(sizeLimitPath, 'utf8'));
      const entryPath = `packages/${name}/dist/index.js`;
      if (!sizeLimit.some((e) => e.path === entryPath || e.name === pkgName)) {
        sizeLimit.push({
          name: pkgName,
          path: entryPath,
          limit: budget,
        });
        writeFileSync(sizeLimitPath, JSON.stringify(sizeLimit, null, 2) + '\n');
      }
    }

    // 2. Update root tsconfig.json references
    const rootTsconfigPath = join(rootDir, 'tsconfig.json');
    if (existsSync(rootTsconfigPath)) {
      const rootTsconfig = JSON.parse(readFileSync(rootTsconfigPath, 'utf8'));
      const refPath = `./packages/${name}`;
      if (
        Array.isArray(rootTsconfig.references) &&
        !rootTsconfig.references.some((r) => r.path === refPath)
      ) {
        rootTsconfig.references.push({ path: refPath });
        writeFileSync(rootTsconfigPath, JSON.stringify(rootTsconfig, null, 2) + '\n');
      }
    }
  }

  return {
    pkgDir,
    pkgName,
    layer,
    budget,
    isDual,
    hasPeers,
    pkgJson,
  };
}

function main() {
  const parsed = parseScaffoldArgs(process.argv.slice(2));
  const result = scaffoldPackage(parsed);
  console.log(
    `✅ Scaffolded ${result.pkgName} (${result.layer}) at packages/${parsed.name} [budget: ${result.budget}]`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    console.error(`❌ new:package failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
