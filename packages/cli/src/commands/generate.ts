import type { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { output } from '../output';
import { CliFailure } from '../failure';
import { componentTemplate, pageTemplate, actionTemplate } from '../templates';
export function registerGenerateCommand(program: Command): void {
  program.command('generate <type> <name>').alias('g').description('Generate a component, page, or action without overwriting files')
    .option('-d, --dir <directory>', 'Output directory (overrides default)')
    .action((input: string, raw: string, options: { dir?: string }) => {
      const type = input.toLowerCase(); const name = raw.trim().normalize('NFC');
      if (!['component', 'page', 'action'].includes(type)) throw new CliFailure(`Unknown type: ${type}. Choose component, page or action.`);
      if (!(type === 'action' ? /^[a-z][a-zA-Z0-9]*$/ : /^[A-Z][a-zA-Z0-9]*$/).test(name)) throw new CliFailure(`Invalid ${type} name: ${name}. Use ${type === 'action' ? 'camelCase' : 'PascalCase'}.`);
      const directory = options.dir ?? path.join(process.cwd(), type === 'page' ? 'pages' : `src/${type === 'action' ? 'actions' : 'components'}`);
      const filename = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() + (type === 'action' ? '.ts' : '.html');
      const target = path.resolve(directory, filename);
      const content = type === 'component' ? componentTemplate(name) : type === 'page' ? pageTemplate(name) : actionTemplate(name);
      try { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(target, content, { encoding: 'utf8', flag: 'wx' }); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new CliFailure(`File already exists: ${target}`); throw error; }
      output.result({ type, name, file: target }); output.line(`[OK] ${type} '${name}' created at: ${target}`);
    });
}
