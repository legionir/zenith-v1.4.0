// packages/cli/src/lighthouse.ts
//
// Bug Fix #6: Lighthouse PWA Audit Script
//
// این ماژول یک دستور `zenith lighthouse` به CLI اضافه می‌کند که:
//   1. یک static server محلی روی پورت موقت راه‌اندازی می‌کند.
//   2. Lighthouse را روی URL اجرا می‌کند.
//   3. نتایج PWA audit را parse می‌کند.
//   4. در CI mode (--ci) اگر امتیاز PWA کمتر از 90 باشد، exit code 1 می‌دهد.
//
// پیش‌نیازها:
//   - Chrome یا Chromium نصب باشد.
//   - lighthouse به‌صورت devDependency نصب باشد: npm install -D lighthouse
//
// استفاده:
//   zenith lighthouse ./dist                # audit پوشه‌ی dist
//   zenith lighthouse ./dist --port 8080    # پورت سفارشی
//   zenith lighthouse ./dist --ci           # CI mode (exit 1 if score < 90)
import fs from 'fs';
import path from 'path';
/**
 * راه‌اندازی یک static server ساده برای serve کردن پوشه.
 */
function startStaticServer(rootDir, port) {
    // استفاده از node http مستقیم برای سادگی
    const http = require('node:http');
    const url = require('node:url');
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.webp': 'image/webp',
        '.webmanifest': 'application/manifest+json',
    };
    const server = http.createServer((req, res) => {
        let pathname = url.parse(req.url).pathname;
        if (pathname === '/')
            pathname = '/index.html';
        const filePath = path.join(rootDir, pathname);
        // Security: جلوگیری از directory traversal
        if (!filePath.startsWith(rootDir)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not Found');
                return;
            }
            const ext = path.extname(filePath).toLowerCase();
            const mime = mimeTypes[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': mime });
            res.end(data);
        });
    });
    return new Promise((resolve) => {
        server.listen(port, () => {
            const actualPort = server.address().port;
            resolve({
                process: server,
                url: `http://localhost:${actualPort}`,
                stop: () => server.close(),
            });
        });
    });
}
/**
 * اجرای lighthouse روی یک URL.
 */
async function runLighthouse(url, options) {
    let lighthouse;
    try {
        lighthouse = require('lighthouse').default;
    }
    catch {
        throw new Error('[Zenith Lighthouse] lighthouse is not installed. Install it with: npm install -D lighthouse');
    }
    const chromeFlags = options.chromePath
        ? [`--chrome-path=${options.chromePath}`]
        : [];
    const flags = {
        onlyCategories: ['pwa', 'performance', 'accessibility', 'best-practices', 'seo'],
        output: 'json',
        quiet: !options.verbose,
        chromeFlags: chromeFlags,
    };
    const result = await lighthouse(url, flags);
    return result;
}
/**
 * اجرای lighthouse audit روی یک پوشه.
 *
 * @param rootDir پوشه‌ای که باید audit شود (مثل dist).
 * @param options گزینه‌های audit.
 * @returns نتیجه‌ی audit.
 */
export async function runLighthouseAudit(rootDir, options = {}) {
    if (!fs.existsSync(rootDir)) {
        throw new Error(`[Zenith Lighthouse] Path not found: ${rootDir}`);
    }
    const stat = fs.statSync(rootDir);
    if (!stat.isDirectory()) {
        throw new Error(`[Zenith Lighthouse] Not a directory: ${rootDir}`);
    }
    // بررسی وجود index.html
    const indexPath = path.join(rootDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
        throw new Error(`[Zenith Lighthouse] index.html not found in ${rootDir}. ` +
            `Run 'npm run build' first to generate the dist folder.`);
    }
    console.log(`[Zenith Lighthouse] Starting static server for: ${rootDir}`);
    const port = options.port || 0;
    const server = await startStaticServer(rootDir, port);
    try {
        console.log(`[Zenith Lighthouse] Server running at: ${server.url}`);
        console.log(`[Zenith Lighthouse] Running Lighthouse audit...`);
        const lighthouseResult = await runLighthouse(server.url, options);
        const lhr = lighthouseResult.lhr;
        const pwaScore = Math.round((lhr.categories.pwa?.score || 0) * 100);
        const performanceScore = Math.round((lhr.categories.performance?.score || 0) * 100);
        const accessibilityScore = Math.round((lhr.categories.accessibility?.score || 0) * 100);
        const bestPracticesScore = Math.round((lhr.categories['best-practices']?.score || 0) * 100);
        const seoScore = Math.round((lhr.categories.seo?.score || 0) * 100);
        // استخراج failed PWA audits
        const failedAudits = [];
        const pwaAuditRefs = lhr.categories.pwa?.auditRefs || [];
        for (const ref of pwaAuditRefs) {
            const audit = lhr.audits[ref.id];
            if (audit && audit.score !== null && audit.score < 1) {
                failedAudits.push({
                    id: audit.id,
                    title: audit.title,
                    description: audit.description,
                });
            }
        }
        const minScore = options.minScore ?? 90;
        const passed = !options.ci || pwaScore >= minScore;
        // ذخیره‌ی HTML report
        const reportPath = path.join(rootDir, 'lighthouse-report.html');
        if (lighthouseResult.report) {
            fs.writeFileSync(reportPath, lighthouseResult.report, 'utf-8');
        }
        return {
            pwaScore,
            performanceScore,
            accessibilityScore,
            bestPracticesScore,
            seoScore,
            failedAudits,
            passed,
            reportPath,
        };
    }
    finally {
        server.stop();
    }
}
/**
 * نمایش نتایج lighthouse audit.
 */
export function printLighthouseResult(result) {
    const COLORS = {
        red: '\x1b[31m',
        yellow: '\x1b[33m',
        green: '\x1b[32m',
        blue: '\x1b[34m',
        gray: '\x1b[90m',
        reset: '\x1b[0m',
        bold: '\x1b[1m',
    };
    const scoreColor = (score) => {
        if (score >= 90)
            return COLORS.green;
        if (score >= 50)
            return COLORS.yellow;
        return COLORS.red;
    };
    console.log('');
    console.log(`${COLORS.bold}━━━ Lighthouse Audit Results ━━━${COLORS.reset}`);
    console.log('');
    console.log(`  PWA:              ${scoreColor(result.pwaScore)}${result.pwaScore}${COLORS.reset}/100`);
    console.log(`  Performance:      ${scoreColor(result.performanceScore)}${result.performanceScore}${COLORS.reset}/100`);
    console.log(`  Accessibility:    ${scoreColor(result.accessibilityScore)}${result.accessibilityScore}${COLORS.reset}/100`);
    console.log(`  Best Practices:   ${scoreColor(result.bestPracticesScore)}${result.bestPracticesScore}${COLORS.reset}/100`);
    console.log(`  SEO:              ${scoreColor(result.seoScore)}${result.seoScore}${COLORS.reset}/100`);
    console.log('');
    if (result.failedAudits.length > 0) {
        console.log(`${COLORS.bold}━━━ Failed PWA Audits (${result.failedAudits.length}) ━━━${COLORS.reset}`);
        for (const audit of result.failedAudits) {
            console.log(`  ${COLORS.red}✗${COLORS.reset} ${audit.title}`);
            console.log(`    ${COLORS.gray}${audit.description}${COLORS.reset}`);
        }
        console.log('');
    }
    else {
        console.log(`${COLORS.green}✓ All PWA audits passed!${COLORS.reset}`);
        console.log('');
    }
    if (result.reportPath) {
        console.log(`${COLORS.gray}HTML report saved to: ${result.reportPath}${COLORS.reset}`);
        console.log('');
    }
    if (result.passed) {
        console.log(`${COLORS.green}✓ Audit passed!${COLORS.reset}`);
    }
    else {
        console.log(`${COLORS.red}✗ Audit failed (PWA score < threshold).${COLORS.reset}`);
    }
}
//# sourceMappingURL=lighthouse.js.map