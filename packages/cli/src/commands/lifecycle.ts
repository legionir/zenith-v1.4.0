import type { Command } from 'commander';
import { output } from '../output';
import { runLifecycle, type RunnerOptions } from '../lifecycle/runner';
import { inspectProject } from '../lifecycle/doctor';
import { upgradeProject } from '../lifecycle/upgrade';

export function registerLifecycleCommands(program: Command): void {
  for (const name of ['dev', 'build', 'test'] as const) {
    const command = program.command(name).description(`Run the project's ${name} lifecycle (no automatic dependency installation)`)
      .option('--cwd <directory>', 'Project directory', '.')
      .option('--config <file>', 'Explicit tool configuration')
      .option('--timeout <ms>', 'Whole child-process deadline; 0 disables it', '0')
      .argument('[args...]', 'Additional tool arguments after --');
    if (name === 'dev') command.option('--host <host>', 'Bind address (default Vite fallback: 0.0.0.0)').option('--port <port>', 'Development port');
    if (name === 'test') command.option('--watch', 'Opt in to watch mode');
    command.action(async (args: string[], options: RunnerOptions) => { await runLifecycle(name, { ...options, args }); });
  }
  program.command('doctor').description('Inspect Node, installed dependency versions, physical state copies and configuration')
    .option('--cwd <directory>', 'Project directory', '.')
    .action((options: { cwd: string }) => {
      const report = inspectProject(options.cwd); output.result(report);
      for (const item of report.findings) output.line(`${item.level.toUpperCase()} ${item.code}: ${item.message}${item.path ? ` (${item.path})` : ''}`);
      output.status(report.findings.some(item => item.level === 'error') ? 1 : 0);
    });
  program.command('upgrade').description('Plan safe binding-aware API migrations and bundled version updates; never installs dependencies')
    .option('--cwd <directory>', 'Project directory', '.').option('--write', 'Apply the plan with exclusive .zenith.bak backups', false)
    .action((options: { cwd: string; write: boolean }) => {
      const report = upgradeProject(options.cwd, options.write); output.result(report);
      for (const item of report.changes) output.line(`${report.applied ? 'UPDATED' : 'PLAN'} ${item.path}: ${item.migrations.join('; ')}`);
      for (const item of report.manual) output.error(`MANUAL ${item}`);
      output.line(report.applied ? 'Applied. Review backups and regenerate your lockfile explicitly.' : 'Read-only plan. Use --write to apply with backups.');
      output.status(report.manual.length ? 1 : 0);
    });
}
