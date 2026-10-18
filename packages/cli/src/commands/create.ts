import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getTemplateManifest, type ZenithTemplateKind } from '../templates';
import { validateProjectName } from '../validate-project-name';
import { output } from '../output';
import { CliFailure } from '../failure';
/** Both CLI creation and preview use exactly one manifest/layout. */
export function registerCreateCommand(program: Command): void {
  program.command('create <project-name>').description('Create a new Zenith application')
    .option('--no-git', 'Skip git initialization').option('--pwa', 'Alias for --template pwa')
    .option('-t, --template <kind>', 'spa|ssr|pwa|dashboard|minimal', 'spa')
    .action((input: string, opts: { git: boolean; pwa: boolean; template: ZenithTemplateKind }) => {
      const name = input.trim().normalize('NFC'); const invalid = validateProjectName(name, process.cwd());
      if (invalid) { output.error(`[ERROR] Invalid project name: ${invalid}`); output.status(1); return; }
      const destination = path.join(process.cwd(), name);
      if (fs.existsSync(destination)) { output.error(`[ERROR] Directory "${name}" already exists!`); output.status(1); return; }
      const written: string[] = []; const directories: string[] = [];
      const ensureDirectory = (directory: string) => {
        const missing: string[] = []; let cursor = directory;
        while (!fs.existsSync(cursor)) { missing.push(cursor); cursor = path.dirname(cursor); }
        for (const item of missing.reverse()) { try { fs.mkdirSync(item); directories.push(item); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; } }
      };
      try {
        if (opts.pwa && opts.template !== 'spa' && opts.template !== 'pwa') throw new CliFailure('--pwa conflicts with --template.');
        const kind = opts.pwa ? 'pwa' : opts.template; const files = getTemplateManifest(name, kind);
        // Exclusive directory creation prevents silently overwriting a concurrent creator.
        fs.mkdirSync(destination); directories.push(destination);
        for (const [relative, content] of Object.entries(files)) {
          const file = path.resolve(destination, relative); if (!file.startsWith(destination + path.sep)) throw new CliFailure('Scaffold path escapes project.', 2);
          ensureDirectory(path.dirname(file)); fs.writeFileSync(file, content, { encoding: 'utf8', flag: 'wx' }); written.push(file);
          output.line(`  [OK] Created: ${relative}`);
        }
        ensureDirectory(path.join(destination, 'src/components')); ensureDirectory(path.join(destination, 'pages'));
        if (opts.git) { try { execFileSync('git', ['init', '--quiet'], { cwd: destination, stdio: 'ignore' }); } catch { output.error('Git initialization unavailable; project files were created.'); } }
        const userAgent = process.env.npm_config_user_agent ?? ''; const pnpm = userAgent.includes('pnpm') || fs.existsSync(path.join(process.cwd(), 'pnpm-lock.yaml'));
        const yarn = !pnpm && (userAgent.includes('yarn') || fs.existsSync(path.join(process.cwd(), 'yarn.lock')));
        output.result({ name, template: kind, destination, files: Object.keys(files) });
        output.line(`[DONE] Project "${name}" created successfully!`); output.line(`  cd ${name}`); output.line(`  ${pnpm ? 'pnpm install' : yarn ? 'yarn' : 'npm install'}`); output.line(`  ${pnpm ? 'pnpm dev' : yarn ? 'yarn dev' : 'npm run dev'}`);
      } catch (error) {
        // Never recursively remove files a concurrent writer may have created.
        for (const file of written.reverse()) { try { fs.unlinkSync(file); } catch {} }
        for (const directory of directories.reverse()) { try { fs.rmdirSync(directory); } catch {} }
        throw error instanceof CliFailure ? error : new CliFailure(error instanceof Error ? error.message : 'Project creation failed.', error instanceof RangeError ? 1 : 2); }
    });
}
