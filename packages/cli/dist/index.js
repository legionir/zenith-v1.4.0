#!/usr/bin/env node
// packages/cli/src/index.ts
//
// CLI برای فریم‌ورک Zenith — فاز ۱۰.
//
// این ابزار به توسعه‌دهنده اجازه می‌دهد:
//   - پروژه‌ی جدید بسازد (create)
//   - کامپوننت تولید کند (generate component)
//   - صفحه تولید کند (generate page)
//   - action تولید کند (generate action)
//
// استفاده:
//   zenith create my-app
//   zenith generate component UserCard
//   zenith g page About
//   zenith g action saveUser
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { indexHtmlTemplate, mainTsTemplate, viteConfigTemplate, packageJsonTemplate, tsConfigTemplate, readmeTemplate, componentTemplate, pageTemplate, actionTemplate, gitignoreTemplate, pwaManifestTemplate, pwaServiceWorkerTemplate, pwaViteConfigTemplate, pwaMainTsTemplate, pwaReadmeTemplate, } from './templates.js';
import { runCheck } from './check.js';
import { runLighthouseAudit, printLighthouseResult } from './lighthouse.js';
const program = new Command();
program
    .name('zenith')
    .description('CLI for Zenith HTML-First Framework')
    .version('0.1.0');
// ─────────────────────────────────────────────
// دستور: create <project-name>
// ─────────────────────────────────────────────
program
    .command('create <project-name>')
    .description('Create a new Zenith application')
    .option('--no-git', 'Skip git initialization')
    .option('--pwa', 'Create a Progressive Web App with service worker and manifest')
    .action((projectName, opts) => {
    const projectDir = path.join(process.cwd(), projectName);
    // بررسی اینکه آیا directory از قبل وجود دارد.
    if (fs.existsSync(projectDir)) {
        console.error(`[ERROR] Directory "${projectName}" already exists!`);
        process.exit(1);
    }
    const isPwa = opts.pwa === true;
    console.log(`[START] Creating Zenith project: ${projectName}${isPwa ? ' (PWA mode)' : ''}...`);
    // ساخت directory اصلی.
    fs.mkdirSync(projectDir, { recursive: true });
    // ساخت فایل‌های پایه.
    // در حالت PWA، از قالب‌های PWA استفاده می‌کنیم.
    const files = isPwa
        ? [
            { path: 'index.html', content: indexHtmlTemplate(projectName) },
            { path: 'main.ts', content: pwaMainTsTemplate() },
            { path: 'vite.config.ts', content: pwaViteConfigTemplate() },
            { path: 'package.json', content: packageJsonTemplate(projectName) },
            { path: 'tsconfig.json', content: tsConfigTemplate() },
            { path: 'README.md', content: pwaReadmeTemplate(projectName) },
            { path: '.gitignore', content: gitignoreTemplate() },
            // PWA-specific
            { path: 'public/manifest.json', content: pwaManifestTemplate(projectName) },
            { path: 'public/sw.js', content: pwaServiceWorkerTemplate() },
        ]
        : [
            { path: 'index.html', content: indexHtmlTemplate(projectName) },
            { path: 'main.ts', content: mainTsTemplate() },
            { path: 'vite.config.ts', content: viteConfigTemplate() },
            { path: 'package.json', content: packageJsonTemplate(projectName) },
            { path: 'tsconfig.json', content: tsConfigTemplate() },
            { path: 'README.md', content: readmeTemplate(projectName) },
            { path: '.gitignore', content: gitignoreTemplate() },
        ];
    for (const file of files) {
        const filePath = path.join(projectDir, file.path);
        const fileDir = path.dirname(filePath);
        if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
        }
        fs.writeFileSync(filePath, file.content, 'utf-8');
        console.log(`  [OK] Created: ${file.path}`);
    }
    // ساخت پوشه‌های src/components و pages.
    fs.mkdirSync(path.join(projectDir, 'src', 'components'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'pages'), { recursive: true });
    console.log('  [OK] Created: src/components/');
    console.log('  [OK] Created: pages/');
    if (isPwa) {
        // ساخت پوشه‌ی icons با یک README راهنما
        const iconsDir = path.join(projectDir, 'public', 'icons');
        fs.mkdirSync(iconsDir, { recursive: true });
        const iconsReadme = [
            '# PWA Icons',
            '',
            'Place the following icons here:',
            '',
            '- icon-192.png (192x192)',
            '- icon-512.png (512x512)',
            '- shortcut-home.png (96x96)',
            '- badge-72.png (72x72)',
            '',
            'Generate icons with: https://realfavicongenerator.net/',
            '',
        ].join('\n');
        fs.writeFileSync(path.join(iconsDir, 'README.md'), iconsReadme, 'utf-8');
        console.log('  [OK] Created: public/icons/ (add your icons here)');
    }
    console.log('');
    console.log(`[DONE] Project "${projectName}" created successfully!`);
    console.log('');
    console.log('Next steps:');
    console.log(`  cd ${projectName}`);
    console.log('  npm install');
    if (isPwa) {
        console.log('  # Add your PWA icons to public/icons/');
        console.log('  # Add vite-plugin-pwa to your devDependencies:');
        console.log('  npm install -D vite-plugin-pwa workbox-window');
    }
    console.log('  npm run dev');
    console.log('');
    console.log('Then open http://localhost:3000 in your browser.');
});
// ─────────────────────────────────────────────
// دستور: generate <type> <name>  (alias: g)
// ─────────────────────────────────────────────
program
    .command('generate <type> <name>')
    .alias('g')
    .description('Generate a new component, page, or action')
    .option('-d, --dir <directory>', 'Output directory (overrides default)')
    .action((type, name, opts) => {
    type = type.toLowerCase();
    switch (type) {
        case 'component':
            return generateComponent(name, opts.dir);
        case 'page':
            return generatePage(name, opts.dir);
        case 'action':
            return generateAction(name, opts.dir);
        default:
            console.error(`[ERROR] Unknown type: "${type}". Valid types: component, page, action`);
            process.exit(1);
    }
});
/**
 * تولید یک کامپوننت جدید.
 */
function generateComponent(name, customDir) {
    // اعتبارسنجی نام.
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
        console.error(`[ERROR] Invalid component name: "${name}". Must be PascalCase (e.g., UserCard).`);
        process.exit(1);
    }
    const dir = customDir || path.join(process.cwd(), 'src', 'components');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const fileName = name
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase() + '.html';
    const filePath = path.join(dir, fileName);
    if (fs.existsSync(filePath)) {
        console.error(`[ERROR] File already exists: ${filePath}`);
        process.exit(1);
    }
    const content = componentTemplate(name);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[OK] Component '${name}' created at: ${filePath}`);
    console.log(`   Import it in your HTML: <link rel="import" href="${path.relative(process.cwd(), filePath)}">`);
}
/**
 * تولید یک صفحه‌ی جدید (برای SPA).
 */
function generatePage(name, customDir) {
    // اعتبارسنجی نام.
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
        console.error(`[ERROR] Invalid page name: "${name}". Must be PascalCase (e.g., About).`);
        process.exit(1);
    }
    const dir = customDir || path.join(process.cwd(), 'pages');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const fileName = name
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase() + '.html';
    const filePath = path.join(dir, fileName);
    if (fs.existsSync(filePath)) {
        console.error(`[ERROR] File already exists: ${filePath}`);
        process.exit(1);
    }
    const content = pageTemplate(name);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[OK] Page '${name}' created at: ${filePath}`);
    console.log(`   Add a route in your HTML: <zen-route path="/${name.toLowerCase()}" src="/pages/${fileName}"></zen-route>`);
}
/**
 * تولید یک Action جدید.
 */
function generateAction(name, customDir) {
    // اعتبارسنجی نام (camelCase).
    if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) {
        console.error(`[ERROR] Invalid action name: "${name}". Must be camelCase (e.g., saveUser).`);
        process.exit(1);
    }
    const dir = customDir || path.join(process.cwd(), 'src', 'actions');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const fileName = name
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase() + '.ts';
    const filePath = path.join(dir, fileName);
    if (fs.existsSync(filePath)) {
        console.error(`[ERROR] File already exists: ${filePath}`);
        process.exit(1);
    }
    const content = actionTemplate(name);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[OK] Action '${name}' created at: ${filePath}`);
    console.log(`   Import it in main.ts: import './src/actions/${fileName.replace('.ts', '')}';`);
}
// ─────────────────────────────────────────────
// دستور: info (نمایش اطلاعات محیط)
// ─────────────────────────────────────────────
program
    .command('info')
    .description('Display Zenith framework info')
    .action(() => {
    console.log('Zenith Framework - CLI v0.1.0');
    console.log('');
    console.log('Available commands:');
    console.log('  zenith create <name>          Create a new project');
    console.log('  zenith create <name> --pwa    Create a PWA project (with service worker)');
    console.log('  zenith generate <type> <name> Generate component/page/action');
    console.log('  zenith check [path]           Static analysis of HTML files');
    console.log('  zenith lighthouse <path>      PWA audit (requires lighthouse + Chrome)');
    console.log('  zenith info                   Show this info');
    console.log('');
    console.log('Generate types:');
    console.log('  component  → src/components/<name>.html');
    console.log('  page       → pages/<name>.html');
    console.log('  action     → src/actions/<name>.ts');
    console.log('');
    console.log('Check rules:');
    console.log('  Z100  compileAndRender usage (removed for security)');
    console.log('  Z101  eval() or new Function() in <script>');
    console.log('  Z200  Deprecated directive');
    console.log('  Z201  Unknown directive');
    console.log('  Z300  zen-for without zen-key');
    console.log('  Z301  zen-text with empty expression');
    console.log('  Z302  zen-if with empty condition');
    console.log('  Z400  Expression syntax error');
    console.log('  Z500  $parent used without property access');
    console.log('  Z600  zen-route without src');
    console.log('  Z601  zen-route without path');
    console.log('  Z700  zen-link without href');
    console.log('  Z800  Compiler unsupported directive (runtime fallback warning)');
    console.log('  Z810  zen-virtual-list without zen-dynamic-heights (info)');
    console.log('  Z820  i18n function used without context registration (info)');
});
// ─────────────────────────────────────────────
// دستور: check [path] — تحلیل استاتیک HTML
// ─────────────────────────────────────────────
program
    .command('check [path]')
    .description('Static analysis of HTML files for Zenith directives and expressions')
    .option('--strict', 'Treat warnings as errors (for CI)')
    .option('--ci', 'CI mode (alias for --strict)')
    .option('--quiet', 'Only show summary, not individual findings')
    .action((target, opts) => {
    const exitCode = runCheck(target || '.', opts);
    process.exit(exitCode);
});
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
    .action(async (target, opts) => {
    try {
        const result = await runLighthouseAudit(target, {
            port: opts.port ? parseInt(opts.port, 10) : 0,
            ci: opts.ci,
            minScore: opts.minScore ? parseInt(opts.minScore, 10) : 90,
            chromePath: opts.chromePath,
            verbose: opts.verbose,
        });
        printLighthouseResult(result);
        process.exit(result.passed ? 0 : 1);
    }
    catch (e) {
        console.error(`[Zenith Lighthouse] Error: ${e.message}`);
        process.exit(2);
    }
});
// ─────────────────────────────────────────────
// parse و اجرا
// ─────────────────────────────────────────────
program.parse(process.argv);
// اگر هیچ آرگومانی داده نشد، help را نمایش بده.
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
//# sourceMappingURL=index.js.map