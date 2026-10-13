// scripts/test/wave5-batch2.test.mjs
// Wave 5 P2 Batch 2: پنج پکیج L2 جدید — theme (#161), auth-oauth (#162),
// feature-flags (#168), charts (#169), icons (#170).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = (name) => join(root, 'packages', name);

describe('Wave 5 Batch 2: پنج پکیج L2 جدید (#161,#162,#168,#169,#170)', () => {
  const pkgs = ['theme', 'auth-oauth', 'feature-flags', 'charts', 'icons'];

  it('هر پکیج ساختار کامل دارد (src/index.ts، package.json، tsconfig، README، LICENSE)', () => {
    for (const name of pkgs) {
      expect(existsSync(join(pkg(name), 'src', 'index.ts')), name).toBe(true);
      expect(existsSync(join(pkg(name), 'package.json')), name).toBe(true);
      expect(existsSync(join(pkg(name), 'tsconfig.json')), name).toBe(true);
      expect(existsSync(join(pkg(name), 'README.md')), name).toBe(true);
      expect(existsSync(join(pkg(name), 'LICENSE')), `${name}-LICENSE`).toBe(true);
      const manifest = JSON.parse(readFileSync(join(pkg(name), 'package.json'), 'utf8'));
      expect(manifest.name).toBe(`@zenith/${name}`);
      expect(manifest.version).toBe('1.4.0');
      expect(manifest.type).toBe('module');
    }
  });

  it('#161: theme — createTheme + اسکریپت no-flash + دایرکتیو zen-theme-toggle', () => {
    const src = readFileSync(join(pkg('theme'), 'src', 'index.ts'), 'utf8');
    expect(src).toContain('createTheme');
    expect(src).toContain('themePlugin');
    expect(readFileSync(join(pkg('theme'), 'src', 'theme.ts'), 'utf8')).toContain('themeInitScript');
    const directives = readFileSync(join(pkg('theme'), 'src', 'directives.ts'), 'utf8');
    expect(directives).toContain('theme-toggle');
    expect(directives).toContain('zen-dir');
  });

  it('#162: auth-oauth — PKCE S256 در buildAuthorizeUrl و state/nonceردیابی می‌شود', async () => {
    const { randomToken, pkceChallenge } = await import(join(root, 'packages/auth-oauth/src/pkce.ts'));
    const token = randomToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43,64}$/);
    const ch = await pkceChallenge(token);
    expect(ch).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(ch).not.toBe(token);
    // callback flow: state نامشخص باید ZEN-2101 رد شود
    const { createOAuthClient } = await import(join(root, 'packages/auth-oauth/src/index.ts'));
    const client = createOAuthClient({
      issuer: 'https://issuer.example', clientId: 'app', redirectUri: 'http://x/cb',
      fetchImpl: (async () => { throw new Error('net'); }),
    });
    await expect(client.handleCallback('http://x/cb?code=c&state=unknown')).rejects.toMatchObject({
      code: 'ZEN-2101',
    });
    await client.dispose();
  });

  it('#168: feature-flags — rollout hash پایدار + override با Cleanup (#168)', async () => {
    const { createFlags } = await import(join(root, 'packages/feature-flags/src/flags.ts'));
    const { flushSync } = await import(join(root, 'packages/scheduler/src/index.ts'));
    const flags = createFlags({ source: { exp: true, legacy: false } });
    const sig = flags.flag('exp');
    flushSync();
    expect(sig.get()).toBe(true);
    expect(flags.flag('legacy').get()).toBe(false);
    const cleanup = flags.override('legacy', true); flushSync();
    expect(flags.flag('legacy').get()).toBe(true);
    cleanup(); flushSync();
    expect(flags.flag('legacy').get()).toBe(false);
    flags.dispose();
    // rollout hash: همان userId نتیجهٔ پایدار دارد (در دو instance).
    const a = createFlags({ source: { campaign: true }, context: { userId: 'u-1' }, rollout: 'hash' });
    const b = createFlags({ source: { campaign: true }, context: { userId: 'u-1' }, rollout: 'hash' });
    flushSync();
    expect(a.flag('campaign').get()).toBe(b.flag('campaign').get());
    a.dispose(); b.dispose();
  });

  it('#169: charts — renderChartSvg در Node (بدون DOM) خروجی یکسان SSR می‌سازد', async () => {
    const { renderChartSvg } = await import(join(root, 'packages/charts/src/charts.ts'));
    const data = [{ x: 'الف', v: 1 }, { x: 'ب', v: 2 }];
    const a = renderChartSvg({ type: 'line', data, x: 'x', y: 'v' }, data);
    const b = renderChartSvg({ type: 'line', data, x: 'x', y: 'v' }, data);
    expect(a).toBe(b);
    expect(a).toContain('<svg');
  });

  it('#170: icons — sanitize بدنهٔ SVG بدخواه + BASIC_ICONS حداقل ۵ آیکن', async () => {
    const { sanitizeIconBody, BASIC_ICONS, defineIconSet, hasIcon, registerIcons } =
      await import(join(root, 'packages/icons/src/icons.ts'));
    const hostile = '<path d="M0 0h10"/><script>alert(1)</script><circle onload="x()" r="2"></circle>';
    const clean = sanitizeIconBody(hostile);
    expect(clean).not.toContain('script');
    expect(clean).toContain('d="M0 0h10"');
    expect(Object.keys(BASIC_ICONS).length).toBeGreaterThanOrEqual(5);
    const dispose = defineIconSet('brand', { logo: { body: '<rect width="8" height="8" />' } });
    expect(hasIcon('logo', { registry: 'brand' })).toBe(true);
    dispose();
    expect(hasIcon('logo', { registry: 'brand' })).toBe(false);
    const dispose2 = registerIcons({ temp: { body: '<circle r="1" />' } });
    expect(hasIcon('temp')).toBe(true);
    dispose2();
    expect(hasIcon('temp')).toBe(false);
  });

  it('README ریشه هر پنج ردیف جدید را دارد و API docs برای هر ۵ تولید شده‌اند', () => {
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    const apiDir = join(root, 'docs', 'api');
    for (const name of pkgs) {
      expect(readme).toContain(`packages/${name})`);
      expect(existsSync(join(apiDir, `${name}.md`)), `docs/api/${name}.md`).toBe(true);
    }
  });
});
