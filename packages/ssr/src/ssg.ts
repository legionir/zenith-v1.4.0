// packages/ssr/src/ssg.ts
//
// #163 (@zenith/ssg L4): prerender ایستای مسیرها با ssr + sitemap.xml/robots.txt
// و گزارش کامل build. هستهٔ fs-free است؛ نوشتن فایل بر عهدهٔ CLI (`zenith ssg`).
//
// خطاها: ZEN-1821 (رندر مسیر شکست)، ZEN-1822 (داده در build در دسترس نیست).

import { ZenithError } from '@zenith/errors';
import { renderToString, generateFullPage, type SSRHeadInput, type SSRI18nInput } from './render';

export interface StaticRouteDef {
  path: string;
  prerender?: boolean;
  getStaticPaths?: () => string[] | Promise<string[]>;
  head?: SSRHeadInput;
  i18n?: SSRI18nInput;
  state?: Record<string, unknown>;
}

export interface RouterLikeRoute {
  path: string;
  meta?: Record<string, unknown> & {
    prerender?: boolean;
    getStaticPaths?: StaticRouteDef['getStaticPaths'];
  };
}

/**
 * #163: تبدیل تعریف‌های ساده/build-time به مسیرهای استاتیک.
 */
export function defineStaticRoutes(
  routes: Array<string | StaticRouteDef | RouterLikeRoute>,
): StaticRouteDef[] {
  return routes
    .map((r) => {
      if (typeof r === 'string') return { path: r } satisfies StaticRouteDef;
      const def = r as StaticRouteDef & RouterLikeRoute;
      const meta = def.meta ?? {};
      return {
        path: def.path,
        prerender: def.prerender ?? meta.prerender,
        getStaticPaths: def.getStaticPaths ?? meta.getStaticPaths,
        head: def.head,
        i18n: def.i18n,
        state: def.state,
      } satisfies StaticRouteDef;
    })
    .filter((r) => r.prerender !== false);
}

export interface PrerenderOptions {
  routes: Array<string | StaticRouteDef | RouterLikeRoute>;
  template: string;
  app?: import('./render').RenderOptions['app'];
  renderPage?: (route: StaticRouteDef, url: string) => Promise<string>;
  concurrency?: number;
  trailingSlash?: boolean;
  sitemap?: false | { hostname: string; changefreq?: string; priority?: number };
  robots?: boolean | { userAgent?: string; disallow?: string[]; sitemapUrl?: string };
  failOnError?: boolean;
  timeout?: number;
  state?:
    Record<string, unknown> | ((route: StaticRouteDef, url: string) => Record<string, unknown>);
  head?:
    | SSRHeadInput
    | string
    | ((route: StaticRouteDef, url: string) => SSRHeadInput | string | undefined);
  i18n?: SSRI18nInput | ((route: StaticRouteDef, url: string) => SSRI18nInput | undefined);
}

export interface PrerenderReport {
  rendered: number;
  failed: Array<{ route: string; error: string }>;
  durationMs: number;
  routes: string[];
}

export interface PrerenderArtifacts {
  files: Map<string, string>;
  report: PrerenderReport;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** #163: تولید robots.txt. */
export function generateRobotsTxt(
  opts: boolean | { userAgent?: string; disallow?: string[]; sitemapUrl?: string } = true,
): string {
  const cfg = typeof opts === 'object' ? opts : {};
  const ua = cfg.userAgent ?? '*';
  const disallow = cfg.disallow ?? [];
  const lines = [`User-agent: ${ua}`];
  if (disallow.length === 0) lines.push('Allow: /');
  for (const d of disallow) lines.push(`Disallow: ${d}`);
  if (cfg.sitemapUrl) lines.push(`Sitemap: ${cfg.sitemapUrl}`);
  return lines.join('\n') + '\n';
}

/** #163: تولید sitemap.xml معتبر (UTF-8) از URLهای کامل. */
export function generateSitemapXml(
  urls: string[],
  opts: { changefreq?: string; priority?: number; lastmod?: string } = {},
): string {
  const items = urls
    .map((u) => {
      const parts = [`<loc>${escapeXml(u)}</loc>`];
      if (opts.lastmod) parts.push(`<lastmod>${escapeXml(opts.lastmod)}</lastmod>`);
      if (opts.changefreq) parts.push(`<changefreq>${escapeXml(opts.changefreq)}</changefreq>`);
      if (opts.priority !== undefined) {
        parts.push(`<priority>${opts.priority.toFixed(1)}</priority>`);
      }
      return `  <url>${parts.join('')}</url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

function routeToFilePath(route: string, trailingSlash: boolean): string {
  const clean = route.split('?')[0]!.replace(/\/+$/, '');
  if (clean === '') return 'index.html';
  if (trailingSlash) return `${clean.replace(/^\/+/, '')}/index.html`;
  return `${clean.replace(/^\/+/, '')}.html`;
}

function joinUrl(hostname: string, path: string): string {
  const base = hostname.replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function resolveStaticPaths(route: StaticRouteDef): Promise<string[]> {
  if (!route.getStaticPaths) return [route.path];
  try {
    const paths = await route.getStaticPaths();
    if (!Array.isArray(paths)) {
      throw new ZenithError({
        code: 'ZEN-1822',
        category: 'SSR',
        message: `getStaticPaths for "${route.path}" must return an array of paths.`,
        suggestion: 'خروجی getStaticPaths باید string[] باشد.',
      });
    }
    return paths;
  } catch (err) {
    throw new ZenithError({
      code: 'ZEN-1822',
      category: 'SSR',
      message: `Static data for route "${route.path}" is not available at build time.`,
      suggestion: 'getStaticPaths باید در build سینک/بدون شبکه داده بدهد.',
      context: { route: route.path, cause: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * #163: prerender ایستای مسیرها. خروجی Map مسیرفایل→HTML است (fs-free)؛
 * نوشتن روی دیسک به CLI واگذار می‌شود.
 */
export async function prerender(options: PrerenderOptions): Promise<PrerenderArtifacts> {
  const startedAt = Date.now();
  const defs = defineStaticRoutes(options.routes);
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const failOnError = options.failOnError !== false;
  const trailingSlash = options.trailingSlash === true;

  const expanded: Array<{ def: StaticRouteDef; url: string }> = [];
  for (const def of defs) {
    const paths = await resolveStaticPaths(def);
    for (const url of paths) expanded.push({ def, url: url === '' ? '/' : url });
  }

  const files = new Map<string, string>();
  const failed: Array<{ route: string; error: string }> = [];
  const renderer =
    options.renderPage ??
    (async (route: StaticRouteDef, url: string): Promise<string> => {
      const state =
        typeof options.state === 'function'
          ? options.state(route, url)
          : (options.state ?? route.state ?? {});
      const head =
        typeof options.head === 'function'
          ? options.head(route, url)
          : (options.head ?? route.head);
      const i18n =
        typeof options.i18n === 'function'
          ? options.i18n(route, url)
          : (options.i18n ?? route.i18n);
      const result = await renderToString(options.template, state as Record<string, unknown>, {
        route: url,
        app: options.app,
        timeout: options.timeout ?? 15_000,
        head,
        i18n,
      });
      return generateFullPage(result);
    });

  const queue = [...expanded];
  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      try {
        const html = await renderer(item.def, item.url);
        files.set(routeToFilePath(item.url, trailingSlash), html);
      } catch (err) {
        if (err instanceof ZenithError && err.code === 'ZEN-1822') throw err;
        const message = err instanceof Error ? err.message : String(err);
        if (failOnError) {
          throw new ZenithError({
            code: 'ZEN-1821',
            category: 'SSR',
            message: `Prerender of route "${item.url}" failed: ${message}`,
            suggestion: 'خروجی renderer مسیر و state سرور را بررسی کنید.',
            context: { route: item.url },
          });
        }
        failed.push({ route: item.url, error: message });
      }
    }
  };

  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, expanded.length); i++) {
    workers.push(worker());
  }
  const results = await Promise.allSettled(workers);
  const firstFailure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (firstFailure) throw firstFailure.reason;

  if (options.sitemap) {
    const hostname = options.sitemap.hostname.replace(/\/+$/, '');
    const urls = expanded
      .map(({ url }) => joinUrl(hostname, url))
      .filter((u) => !failed.some((f) => u === joinUrl(hostname, f.route)));
    files.set(
      'sitemap.xml',
      generateSitemapXml(urls, {
        changefreq: options.sitemap.changefreq,
        priority: options.sitemap.priority,
      }),
    );
  }
  if (options.robots) {
    const sitemapUrl =
      typeof options.robots === 'object' && options.robots.sitemapUrl
        ? options.robots.sitemapUrl
        : options.sitemap
          ? joinUrl(options.sitemap.hostname, '/sitemap.xml')
          : undefined;
    files.set(
      'robots.txt',
      generateRobotsTxt({
        ...(typeof options.robots === 'object' ? options.robots : {}),
        sitemapUrl,
      }),
    );
  }

  return {
    files,
    report: {
      rendered: Array.from(files.keys()).filter((k) => k.endsWith('.html')).length,
      failed,
      durationMs: Date.now() - startedAt,
      routes: expanded.map(({ url }) => url),
    },
  };
}
