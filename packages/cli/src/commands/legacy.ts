import type { Command } from 'commander';
import fs from 'node:fs';
import { output } from '../output';
import { CliFailure } from '../failure';
import { validateProjectName } from '../validate-project-name';
import { getTemplateManifest } from '../templates';
import { runCheck } from '../check';
import { runLighthouseAudit, printLighthouseResult } from '../lighthouse';
export function registerLegacyCommands(program: Command): void {
program
  .command('check [path]')
  .description('Static analysis of HTML files for Zenith directives and expressions')
  .option('--strict', 'Treat warnings as errors (for CI)')
  .option('--ci', 'CI mode (alias for --strict)')
  .option('--quiet', 'Only show summary, not individual findings')
  .action(
    (target: string | undefined, opts: { strict?: boolean; ci?: boolean; quiet?: boolean }) => {
      const exitCode = runCheck(target || '.', opts);
      output.status(exitCode === 2 ? 1 : exitCode);
    },
  );

// ─────────────────────────────────────────────
// دستور: lighthouse <path> — PWA audit
// ─────────────────────────────────────────────
program
  .command('lighthouse <path>')
  .description('Run Lighthouse PWA audit on a built project (requires lighthouse + Chrome)')
  .option('--port <port>', 'Port for static server (default: random)')
  .option('--ci', 'CI mode: exit 1 if PWA score < threshold')
  .option('--min-score <score>', 'Minimum PWA score for CI (default: 90)', '90')
  .option('--chrome-path <path>', 'Path to Chrome/Chromium executable')
  .option('--verbose', 'Verbose output')
  .action(
    async (
      target: string,
      opts: {
        port?: string;
        ci?: boolean;
        minScore?: string;
        chromePath?: string;
        verbose?: boolean;
      },
    ) => {
      try {
        const result = await runLighthouseAudit(target, {
          port: opts.port ? parseInt(opts.port, 10) : 0,
          ci: opts.ci,
          minScore: opts.minScore ? parseInt(opts.minScore, 10) : 90,
          chromePath: opts.chromePath,
          verbose: opts.verbose,
        });
        output.result(result);
        printLighthouseResult(result);
        output.status(result.passed ? 0 : 1);
      } catch (e) {
        output.error(`[Zenith Lighthouse] Error: ${(e as Error).message}`);
        output.status(2);
      }
    },
  );

// ─────────────────────────────────────────────
// #158: create-zenith scaffold preview (data-driven templates)
// ─────────────────────────────────────────────
program
  .command('create-zenith-preview [name]')
  .description('#158: پیش‌نمایش جادوگر npm create zenith بدون نوشتن روی دیسک')
  .option('-t, --template <kind>', 'نوع قالب (spa|ssr|pwa|dashboard|minimal)', 'spa')
  .action((name: string | undefined, opts: { template: string }) => {
    try {
      const projectName = (name || 'my-zenith-app').trim().normalize('NFC');
      const error = validateProjectName(projectName); if (error) throw new CliFailure(error);
      const manifest = getTemplateManifest(
        projectName,
        opts.template as 'spa' | 'ssr' | 'pwa' | 'dashboard' | 'minimal',
      );
      output.line(`\n📦  create-zenith — ${projectName} [template: ${opts.template}]\n`);
      output.result({ name: projectName, template: opts.template, files: manifest });
      for (const relPath of Object.keys(manifest)) {
        output.line(`   ✔  ${relPath}`);
      }
      output.line('\n✅ جادوگر ساخت پروژه آماده است.\n');
    } catch (e) {
      output.error(`[create-zenith] خطا: ${(e as Error).message}`);
      output.status(1);
    }
  });

// ─────────────────────────────────────────────
// #94: zenith telemetry — opt-in، پیش‌فرض خاموش
// ─────────────────────────────────────────────
program
  .command('telemetry [action]')
  .description('#94: مدیریت telemetry اختیاری (on | off | status) — پیش‌فرض کاملاً خاموش')
  .action((action?: string) => {
    return import('../telemetry')
      .then((m) => (output.status(m.runTelemetry(action))))
      .catch(() => {
        output.error('zenith telemetry: خطای داخلی');
        output.status(2);
      });
  });

// ─────────────────────────────────────────────
// #163: zenith ssg — prerender ایستای مسیرها
// ─────────────────────────────────────────────
program
  .command('ssg')
  .description('#163: prerender ایستای مسیرها + sitemap/robots')
  .requiredOption('-r, --routes <paths...>', 'مسیرهای prerender (فاصله‌جدا)')
  .option('--routes-file <file>', 'فایل متنی مسیرها (هر خط یک مسیر)')
  .requiredOption('-t, --template <file>', 'فایل template پروژه (index.html)')
  .option('-o, --out-dir <dir>', 'پوشهٔ خروجی', 'dist')
  .option('-c, --concurrency <n>', 'همروندی رندر', '4')
  .option('--trailing-slash', 'خروجی به‌صورت <route>/index.html', false)
  .option('--sitemap-host <host>', 'تولید sitemap.xml با hostname')
  .option('--robots', 'تولید robots.txt', false)
  .option('--no-fail-on-error', 'ادامه در صورت شکست رندر یک مسیر')
  .action(
    async (opts: {
      routes: string[];
      routesFile?: string;
      template: string;
      outDir: string;
      concurrency: string;
      trailingSlash: boolean;
      sitemapHost?: string;
      robots: boolean;
      failOnError: boolean;
    }) => {
      try {
        const { runSsg } = await import('../ssg');
        let routes = [...opts.routes];
        if (opts.routesFile && fs.existsSync(opts.routesFile)) {
          routes = routes.concat(
            fs
              .readFileSync(opts.routesFile, 'utf8')
              .split(/\r?\n/)
              .map((l: string) => l.trim())
              .filter((l: string) => l.length > 0),
          );
        }
        const result = await runSsg({
          routes,
          templatePath: opts.template,
          outDir: opts.outDir,
          concurrency: parseInt(opts.concurrency, 10),
          trailingSlash: opts.trailingSlash,
          sitemapHost: opts.sitemapHost,
          robots: opts.robots,
          failOnError: opts.failOnError,
        });
        output.result(result);
        output.line(
          `\n✅ zenith ssg: ${result.rendered} صفحه در ${result.durationMs}ms رندر شد → ${opts.outDir}`,
        );
        for (const f of result.written) output.line(`   • ${f}`);
        if (result.failed.length > 0) {
          output.error(`⚠️  ${result.failed.length} مسیر شکست خورد:`);
          for (const f of result.failed) output.error(`   ✗ ${f.route}: ${f.error}`);
        }
        output.status(result.failed.length > 0 && opts.failOnError ? 1 : 0);
      } catch (e) {
        output.error(`[zenith ssg] خطا: ${(e as Error).message}`);
        output.status(2);
      }
    },
  );


}
