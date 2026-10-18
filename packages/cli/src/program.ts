import { Command, CommanderError } from 'commander';
import { output, withOutputSession } from './output';
import { getCliVersion } from './version';
import { registerCreateCommand } from './commands/create';
import { registerGenerateCommand } from './commands/generate';
import { registerLegacyCommands } from './commands/legacy';
import { registerLifecycleCommands } from './commands/lifecycle';

/** Construct an isolated CLI without parsing arguments or starting subprocesses. @public */
export function createProgram(): Command {
  const program = new Command();
  program.name('zenith').description('Zenith development, diagnostics, migration and scaffolding').version(getCliVersion())
    .option('--json', 'Emit one schemaVersion:1 JSON result (also accepted after the command)')
    .exitOverride().configureOutput({ writeOut: text => output.line(text.replace(/\n$/, '')), writeErr: text => output.error(text.replace(/\n$/, '')) });
  program.hook('preAction', (_command, action) => { output.command(action.name()); });
  registerCreateCommand(program); registerGenerateCommand(program); registerLifecycleCommands(program); registerLegacyCommands(program);
  program.command('info').description('CLI version and available commands').action(() => {
    const commands = program.commands.map(command => ({ name: command.name(), description: command.description() }));
    output.result({ version: getCliVersion(), node: process.versions.node, commands });
    output.line(`Zenith CLI ${getCliVersion()} (Node ${process.versions.node})`);
    for (const command of commands) output.line(`  ${command.name}: ${command.description}`);
  });
  return program;
}
/** Run without process.exit; callers receive 0 success, 1 input/check failure, or 2 infrastructure failure. @public */
export async function runCli(argv: string[] = process.argv.slice(2)): Promise<0 | 1 | 2> {
  const delimiter = argv.indexOf('--'); const cliArgs = delimiter < 0 ? argv : argv.slice(0, delimiter);
  return withOutputSession('zenith', cliArgs.includes('--json'), async () => {
    const program = createProgram();
    try { if (!argv.length) program.outputHelp(); else await program.parseAsync(argv, { from: 'user' }); }
    catch (error) {
      if (error instanceof CommanderError) { output.status(error.exitCode === 0 ? 0 : 1); return; }
      throw error;
    }
  });
}
