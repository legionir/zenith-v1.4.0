// packages/cli/src/ssg.ts
//
// #163 (@zenith/ssg L4): دستور `zenith ssg` — prerender ایستای مسیرها با استفاده
// از هستهٔ fs-free در `@zenith/ssr` (dynamic import تا CLI سبک بماند) و نوشتن
// خروجی‌ها روی دیسک.

import fs from 'fs';
import path from 'path';

export interface SsgCliOptions {
  routes: string[];
  templatePath: string;
  outDir: string;
  concurrency?: number;
  trailingSlash?: boolean;
  sitemapHost?: string;
  robots?: boolean;
  failOnError?: boolean;
  timeout?: number;
}

export interface SsgCliResult {
  written: string[];
  rendered: number;
  failed: Array<{ route: string; error: string }>;
  durationMs: number;
}

interface SsgModule {
  prerender(opts: {
    routes: string[];
    template: string;
    concurrency?: number;
    trailingSlash?: boolean;
    sitemap?: false | { hostname: string; changefreq?: string };
    robots?: boolean | { sitemapUrl?: string };
    failOnError?: boolean;
    timeout?: number;
    head?: string;
  }): Promise<{
    files: Map<string, string>;
    report: {
      rendered: number;
      failed: Array<{ route: string; error: string }>;
      durationMs: number;
    };
  }>;
}

function extractBodyTemplate(raw: string): { body: string; head: string } {
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const headMatch = raw.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return {
    body: bodyMatch ? bodyMatch[1]!.trim() : raw,
    head: headMatch ? headMatch[1]!.trim() : '',
  };
}

/**
 * #163: اجرای prerender و نوشتن فایل‌ها روی دیسک.
 */
export async function runSsg(options: SsgCliOptions): Promise<SsgCliResult> {
  let ssr: SsgModule;
  try {
    ssr = (await import('@zenith/ssr')) as unknown as SsgModule;
  } catch {
    throw new Error('zenith ssg به @zenith/ssr نیاز دارد. آن را نصب کنید: npm i @zenith/ssr');
  }

  if (!fs.existsSync(options.templatePath)) {
    throw new Error(`Template not found: ${options.templatePath}`);
  }
  const rawTemplate = fs.readFileSync(options.templatePath, 'utf8');
  const { body, head } = extractBodyTemplate(rawTemplate);

  const artifacts = await ssr.prerender({
    routes: options.routes,
    template: body,
    concurrency: options.concurrency ?? 4,
    trailingSlash: options.trailingSlash === true,
    sitemap: options.sitemapHost ? { hostname: options.sitemapHost } : false,
    robots: options.robots === true,
    failOnError: options.failOnError !== false,
    timeout: options.timeout ?? 15_000,
    head: head || undefined,
  });

  const written: string[] = [];
  for (const [rel, content] of artifacts.files.entries()) {
    const target = path.join(options.outDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    written.push(target);
  }

  return {
    written,
    rendered: artifacts.report.rendered,
    failed: artifacts.report.failed,
    durationMs: artifacts.report.durationMs,
  };
}
