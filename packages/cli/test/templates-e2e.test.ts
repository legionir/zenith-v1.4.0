// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  indexHtmlTemplate,
  mainTsTemplate,
  pwaMainTsTemplate,
  pwaManifestTemplate,
  pwaServiceWorkerTemplate,
  pwaViteConfigTemplate,
  packageJsonTemplate,
  tsConfigTemplate,
  componentTemplate,
  pageTemplate,
  actionTemplate,
} from '../src/templates';
import { signal } from '@zenith/state';
import { Zen } from '@zenith/runtime';
import { flushSync } from '@zenith/scheduler';
import { expectAccessible, auditAccessibility } from '@zenith/testing';

describe('zenith create templates (standard & --pwa), demos, and automated a11y audit (#33, #99)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('boots indexHtmlTemplate with mainTsTemplate & pwaMainTsTemplate flows and passes accessibility audit', () => {
    const html = indexHtmlTemplate('my-zenith-app');
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    document.body.innerHTML = doc.body.innerHTML;

    // Verify zero serious/critical a11y violations on scaffolded template DOM (#99)
    const a11y = expectAccessible(document.body);
    expect(a11y.violations).toEqual([]);
    expect(a11y.passes).toBeGreaterThanOrEqual(2);

    // Execute the exact reactive flow from mainTsTemplate / pwaMainTsTemplate (#33)
    const state = { count: signal(0) };
    Zen.action('increment', ({ state: s }) => {
      s.count.set(s.count.get() + 1);
    });
    Zen.action('decrement', ({ state: s }) => {
      s.count.set(Math.max(0, s.count.get() - 1));
    });

    const appRoot = document.getElementById('app')!;
    Zen.start(appRoot, state);
    flushSync();

    const counterSpan = appRoot.querySelector('[zen-text="$count"]')!;
    expect(counterSpan.textContent).toBe('0');

    const [incBtn, decBtn] = Array.from(appRoot.querySelectorAll('button'));
    incBtn!.click();
    flushSync();
    expect(counterSpan.textContent).toBe('1');

    incBtn!.click();
    flushSync();
    expect(counterSpan.textContent).toBe('2');

    decBtn!.click();
    flushSync();
    expect(counterSpan.textContent).toBe('1');

    Zen.stop(appRoot);

    // Verify templates contain valid syntax without unescaped backtick bugs
    expect(mainTsTemplate()).toContain("Zen.start(document.getElementById('app')!, state)");
    expect(pwaMainTsTemplate()).toContain("Zen.start(document.getElementById('app')!, state)");
    expect(JSON.parse(pwaManifestTemplate('my-pwa')).display).toBe('standalone');
    expect(pwaServiceWorkerTemplate()).toContain('staleWhileRevalidate');
    expect(pwaViteConfigTemplate()).toContain('VitePWA');
    const generatedPackage = JSON.parse(packageJsonTemplate('my-app'));
    expect(generatedPackage.name).toBe('my-app');
    expect(generatedPackage.devDependencies.vite).toBe('^6.4.4');
    const pluginPackage = JSON.parse(
      readFileSync(join(process.cwd(), 'packages/vite-plugin/package.json'), 'utf8'),
    );
    expect(pluginPackage.peerDependencies.vite.split(' || ')).toContain(
      generatedPackage.devDependencies.vite,
    );
    expect(JSON.parse(tsConfigTemplate()).compilerOptions.strict).toBe(true);
    expect(componentTemplate('UserCard')).toContain('<zen-component name="user-card">');
    expect(pageTemplate('Home')).toContain('page-home');
    expect(actionTemplate('saveUser')).toContain("Zen.action('saveUser'");
  });

  it('audits ecommerce-demo and dashboard HTML and catches intentional serious/critical violations (#33, #99)', () => {
    const ecommerceHtml = readFileSync(join(process.cwd(), 'ecommerce-demo/index.html'), 'utf8');
    const dashboardHtml = readFileSync(join(process.cwd(), 'dashboard/index.html'), 'utf8');

    const parser = new DOMParser();
    const ecomDoc = parser.parseFromString(ecommerceHtml, 'text/html');
    const dashDoc = parser.parseFromString(dashboardHtml, 'text/html');

    expect(expectAccessible(ecomDoc.body).violations).toEqual([]);
    expect(expectAccessible(dashDoc.body).violations).toEqual([]);

    // Intentional accessibility violation must fail expectAccessible (#99 acceptance criteria)
    const badContainer = document.createElement('div');
    badContainer.innerHTML = '<img src="/banner.png"><button></button><input type="text">';
    const report = auditAccessibility(badContainer);
    expect(report.violations.map((v) => v.id)).toEqual(['image-alt', 'button-name', 'label']);
    expect(() => expectAccessible(badContainer)).toThrow(/Accessibility audit failed/);
  });
});
