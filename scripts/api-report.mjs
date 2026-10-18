import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { declarationEntries, inspectDeclarationApi } from './lib/declaration-api.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Official API Extractor configuration for a single real declaration entry. */
export function extractorConfig(entry, root = ROOT) {
  const slug = `${entry.directory}${entry.subpath === '.' ? '' : '--' + entry.subpath.slice(2).replaceAll('/', '--')}${entry.file.endsWith('.d.cts') ? '--cjs' : ''}`;
  return {
    projectFolder: join(root, 'packages', entry.directory),
    mainEntryPointFilePath: entry.file,
    compiler: { tsconfigFilePath: join(root, 'tsconfig.json'), overrideTsconfig: { compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', skipLibCheck: true, types: ['node'], typeRoots: [join(root, 'node_modules/@types')] }, files: [entry.file] } },
    apiReport: { enabled: true, reportFileName: `${slug}.api.md`, reportFolder: join(root, 'docs/api/reports'), reportTempFolder: join(root, 'artifacts/api-reports') },
    docModel: { enabled: true, apiJsonFilePath: join(root, 'artifacts/api-reports', `${slug}.api.json`) },
    dtsRollup: { enabled: false },
    tsdocMetadata: { enabled: false },
    messages: {
      compilerMessageReporting: { default: { logLevel: 'error' } },
      extractorMessageReporting: { default: { logLevel: 'warning' }, 'ae-forgotten-export': { logLevel: 'warning' }, 'ae-missing-release-tag': { logLevel: 'warning' } },
      tsdocMessageReporting: { default: { logLevel: 'warning' } },
    },
  };
}

export function runApiReports({ root = ROOT, update = false, strict = false } = {}) {
  const entries = declarationEntries(root);
  if (!entries.length) throw new Error('No public declaration entries found');
  mkdirSync(join(root, 'docs/api/reports'), { recursive: true });
  mkdirSync(join(root, 'artifacts/api-reports'), { recursive: true });
  let failed = 0;
  for (const entry of entries) {
    const config = ExtractorConfig.prepare({ configObject: extractorConfig(entry, root), configObjectFullPath: join(root, 'packages', entry.directory, 'api-extractor.json'), packageJsonFullPath: join(root, 'packages', entry.directory, 'package.json') });
    const result = Extractor.invoke(config, {
      localBuild: update,
      showVerboseMessages: false,
      messageCallback(message) {
        if (strict && ['ae-missing-release-tag', 'ae-forgotten-export'].includes(message.messageId)) message.logLevel = 'error';
      },
    });
    if (!result.succeeded) failed++;
  }
  const analysis = inspectDeclarationApi(entries, { includeDirectories: [join(root, 'packages')] });
  const report = {
    schemaVersion: 1,
    surface: analysis.surface,
    publicAny: analysis.any.map(f => ({ ...f, file: relative(root, f.file).split('\\').join('/') })),
  };
  writeFileSync(join(root, 'artifacts/api-reports/public-api-analysis.json'), JSON.stringify(report, null, 2) + '\n');
  const snapshot = join(root, 'docs/api/declaration-surface.snapshot.json');
  const text = JSON.stringify({ schemaVersion: 1, surface: report.surface }, null, 2) + '\n';
  if (update) writeFileSync(snapshot, text);
  else if (!existsSync(snapshot) || readFileSync(snapshot, 'utf8') !== text) failed++;
  if (strict && (report.publicAny.length || report.surface.some(s => s.tag !== s.releaseLevel))) failed++;
  return { failed, entries: entries.length, publicAny: report.publicAny.length, unclassified: report.surface.filter(s => s.tag === 'unclassified').length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = runApiReports({ update: process.argv.includes('--write'), strict: process.argv.includes('--strict') });
    process.stdout.write(JSON.stringify(result) + '\n');
    if (result.failed) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
