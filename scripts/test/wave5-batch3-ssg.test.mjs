// scripts/test/wave5-batch3-ssg.test.mjs
// Wave 5 P2 Batch 3: تولید سایت استاتیک (#163) — prerender اعلانی + CLI zenith ssg.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  defineStaticRoutes,
  prerender,
  generateSitemapXml,
  generateRobotsTxt,
} from '../../packages/ssr/src/index.ts';
import { ZenithError } from '../../packages/errors/src/index.ts';

const TEMPLATE =
  '<!doctype html><html><head><title>Static</title></head><body><main id="app"></main></body></html>';

/** renderPage سادهٔ مستند برای تست‌ها (بدون وابستگی به renderToString واقعی). */
const echoRenderer = () => async (route, url) => `<html><body>ROUTE:${url}</body></html>`;

describe('Wave 5 NEW-PACKAGES P2 Batch 3 — Static Site Generation (#163)', () => {
  it('prerender بسط getStaticPaths + آرتیفکت‌های sitemap/robots و نگاشت مسیر→فایل', async () => {
    const routes = defineStaticRoutes([
      '/sitemap-url-not-used',
      { path: '/about' },
      {
        path: '/blog/[slug]',
        getStaticPaths: () => ['/blog/a', '/blog/b'],
      },
      { path: '/hidden', prerender: false },
    ]);

    const result = await prerender({
      routes,
      template: TEMPLATE,
      renderPage: echoRenderer(),
      sitemap: { hostname: 'https://example.com', changefreq: 'weekly', priority: 0.8 },
      robots: true,
    });

    const paths = [...result.files.keys()].sort();
    expect(paths).toEqual([
      'about.html',
      'blog/a.html',
      'blog/b.html',
      'robots.txt',
      'sitemap-url-not-used.html',
      'sitemap.xml',
    ]);
    // مسیر ریشه از getStaticPaths خالی نمی‌ماند — '/hidden' با prerender:false فیلتر شد
    expect(result.report.routes).toContain('/about');
    expect(result.report.routes).not.toContain('/hidden');
    expect(result.report.rendered).toBe(4); // فقط فایل‌های .html
    expect(result.report.failed).toEqual([]);
    expect(result.files.get('blog/a.html')).toContain('ROUTE:/blog/a');

    const xml = result.files.get('sitemap.xml');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<loc>https://example.com/blog/a</loc>');
    expect(xml).toContain('<changefreq>weekly</changefreq>');
    expect(xml).not.toContain('/hidden');

    const robots = result.files.get('robots.txt');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap: https://example.com/sitemap.xml');
  });

  it('trailingSlash خروجی <route>/index.html می‌سازد و ریشه index.html می‌ماند', async () => {
    const res = await prerender({
      routes: ['/', '/dash'],
      template: TEMPLATE,
      renderPage: echoRenderer(),
      trailingSlash: true,
    });
    expect(res.files.has('index.html')).toBe(true);
    expect(res.files.has('dash/index.html')).toBe(true);
    expect(res.files.has('/index.html')).toBe(false);
  });

  it('taxonomy خطا: شکست رندر با failOnError ⇒ ZEN-1821، در غیر این‌صورت در report.failed می‌نشیند؛ دادهٔ ناموجود ⇒ ZEN-1822', async () => {
    const failingRenderer = async (_route, url) => {
      if (url === '/boom') throw new Error('kaboom');
      return `<html>OK:${url}</html>`;
    };
    const soft = await prerender({
      routes: ['/ok', '/boom'],
      template: TEMPLATE,
      renderPage: failingRenderer,
      failOnError: false,
    });
    expect(soft.files.has('ok.html')).toBe(true);
    expect(soft.report.failed).toEqual([{ route: '/boom', error: 'kaboom' }]);

    await expect(
      prerender({
        routes: ['/boom'],
        template: TEMPLATE,
        renderPage: failingRenderer,
        failOnError: true,
      }),
    ).rejects.toMatchObject({ code: 'ZEN-1821' });

    const badData = [
      '/',
      {
        path: '/p/[id]',
        getStaticPaths: () => {
          throw new Error('db offline');
        },
      },
    ];
    await expect(
      prerender({ routes: badData, template: TEMPLATE, renderPage: echoRenderer() }),
    ).rejects.toBeInstanceOf(ZenithError);
    await expect(
      prerender({ routes: badData, template: TEMPLATE, renderPage: echoRenderer() }),
    ).rejects.toMatchObject({ code: 'ZEN-1822' });
  });

  it('generateSitemapXml اسکیپ XML می‌کند و generateRobotsTxt پیش‌فرض‌ها را رعایت می‌کند', () => {
    const xml = generateSitemapXml(['https://x.dev/a?b=1&c=2']);
    expect(xml).toContain('&amp;');
    const robots = generateRobotsTxt({ sitemapUrl: 'https://x.dev/sitemap.xml' });
    expect(robots.endsWith('\n')).toBe(true);
    expect(robots).toContain('Sitemap: https://x.dev/sitemap.xml');
  });

  it('CLI: دستور "zenith ssg" در index.ts ثبت شده و runSsg فایل‌ها را می‌نویسد', () => {
    const cliIndex = readFileSync('packages/cli/src/index.ts', 'utf8');
    expect(cliIndex).toContain(".command('ssg')");
    expect(cliIndex).toContain('--sitemap-host');
    const cliSsg = readFileSync('packages/cli/src/ssg.ts', 'utf8');
    expect(cliSsg).toContain("await import('@zenith/ssr')");
    expect(cliSsg).toContain('writeFileSync');
  });
});
