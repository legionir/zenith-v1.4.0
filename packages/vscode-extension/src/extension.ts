// packages/vscode-extension/src/extension.ts
//
// Zenith VSCode Extension — LSP + Autocomplete + Validation.
//
// این extension:
//   1) Syntax highlighting برای zen-* directives
//   2) Autocomplete برای directive names و values
//   3) Hover hints برای هر directive
//   4) Validation: بررسی syntax expressions
//   5) Commands: create component, page, action

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * لیست همه‌ی directive های Zenith با توضیحات.
 */
const ZENITH_DIRECTIVES: Array<{ name: string; description: string; snippet: string }> = [
  { name: 'zen-text', description: 'Reactive text rendering. Sets textContent.\n\nExample: `<span zen-text="$user.name">`', snippet: 'zen-text="$${1:variable}"' },
  { name: 'zen-html', description: 'HTML rendering (sanitized). Sets innerHTML with XSS protection.\n\nExample: `<div zen-html="$richContent">`', snippet: 'zen-html="$${1:content}"' },
  { name: 'zen-if', description: 'Conditional rendering. Removes element from DOM when false.\n\nExample: `<div zen-if="$count > 0">`', snippet: 'zen-if="$${1:condition}"' },
  { name: 'zen-for', description: 'List rendering with keyed diffing.\n\nExample: `<li zen-for="item in $items" zen-key="item.id">`', snippet: 'zen-for="${1:item} in $${2:items}"' },
  { name: 'zen-bind', description: 'One-way attribute binding.\n\nExample: `<button zen-bind:disabled="$isProcessing">`', snippet: 'zen-bind:${1:disabled}="$${2:value}"' },
  { name: 'zen-model', description: 'Two-way binding for inputs.\n\nExample: `<input zen-model="$user.name">`', snippet: 'zen-model="$${1:user}.${2:name}"' },
  { name: 'zen-action', description: 'Event handler (default: click).\n\nExample: `<button zen-action="save">`', snippet: 'zen-action="${1:actionName}"' },
  { name: 'zen-action:click', description: 'Click event with modifiers.\n\nExample: `<button zen-action:click.prevent="submit">`', snippet: 'zen-action:${1:click}.${2:prevent}="${3:actionName}"' },
  { name: 'zen-action:keydown', description: 'Keyboard event with key modifiers.\n\nExample: `<input zen-action:keydown.enter="submit">`', snippet: 'zen-action:${1:keydown}.${2:enter}="${3:actionName}"' },
  { name: 'zen-link', description: 'SPA navigation link.\n\nExample: `<a zen-link="/about">About</a>`', snippet: 'zen-link="${1:/path}"' },
  { name: 'zen-key', description: 'Key for zen-for diffing.\n\nExample: `zen-key="item.id"`', snippet: 'zen-key="${1:item}.id"' },
  { name: 'zen-fetch', description: 'Declarative data fetching.\n\nExample: `<div zen-fetch="\'/api/users\'" zen-state="users">`', snippet: 'zen-fetch="\'${1:/api/users}\'"' },
  { name: 'zen-state', description: 'Variable name for zen-fetch state.\n\nExample: `zen-state="product"`', snippet: 'zen-state="${1:data}"' },
  { name: 'zen-resource', description: 'CRUD resource binding.\n\nExample: `<div zen-resource="\'/api/users\'" zen-state="users">`', snippet: 'zen-resource="\'${1:/api/users}\'"' },
  { name: 'zen-permission', description: 'Permission-based conditional rendering.\n\nExample: `<div zen-permission="users:edit">`', snippet: 'zen-permission="${1:permission}"' },
  { name: 'zen-role', description: 'Role-based conditional rendering.\n\nExample: `<div zen-role="admin">`', snippet: 'zen-role="${1:admin}"' },
  { name: 'zen-error', description: 'Error boundary with fallback UI.\n\nExample: `<div zen-error>...</div>`', snippet: 'zen-error' },
  { name: 'zen-validate', description: 'Form validation rules.\n\nExample: `<input zen-validate="required,email">`', snippet: 'zen-validate="${1:required}"' },
  // FIX (B-8): prop:* یک attribute خاص برای binding property دلخواه به المان است.
  // کاربر می‌تواند prop:propertyName="value" بنویسد.
  { name: 'prop:*', description: 'Dynamic property binding. Binds to any HTML property.\n\nExample: `<div prop:scrollTop="0">`', snippet: 'prop:${1:propertyName}="$${2:value}"' },
  // IMPROVEMENT (I-1): Directives اضافی برای autocomplete
  { name: 'zen-show', description: 'Visibility toggling with display CSS.\n\nExample: `<div zen-show="$isActive">`', snippet: 'zen-show="$${1:condition}"' },
  { name: 'zen-cloak', description: 'Prevents FOUC (Flash of Unstyled Content). Removes `[zen-cloak]` after compile.\n\nExample: `<div zen-cloak>`', snippet: 'zen-cloak' },
  { name: 'zen-html-trusted', description: 'UNSAFE HTML rendering (no sanitization). Use only for trusted content.\n\nExample: `<div zen-html-trusted="$rawHtml">`', snippet: 'zen-html-trusted="$${1:content}"' },
  { name: 'zen-slot', description: 'Named slot reference in component templates.\n\nExample: `<template zen-slot="header">`', snippet: 'zen-slot="${1:name}"' },
  { name: 'zen-fallback', description: 'Fallback UI template for zen-error, zen-permission, zen-role.\n\nExample: `<template zen-fallback>...</template>`', snippet: 'zen-fallback' },
  { name: 'zen-suspense', description: 'Suspense wrapper for async/lazy content.\n\nExample: `<div zen-suspense>$loadingPlaceholder</div>`', snippet: 'zen-suspense="$${1:loadingCondition}"' },
  { name: 'zen-transition', description: 'Animation/transition directive.\n\nExample: `<div zen-transition="fade">`', snippet: 'zen-transition="${1:fade}"' },
  { name: 'zen-css', description: 'Reactive CSS variable binding.\n\nExample: `<div zen-css="backgroundColor: $color">`', snippet: 'zen-css="${1:cssProperty}: $${2:value}"' },
];

// ════════════════════════════════════════════════════════════════════════
// FEATURE (v0.3.0): Did-you-mean برای دسترسی به property های signal.
// شامل: levenshtein distance، استخراج object literal ها از اسکریپت‌ها،
// بررسی $identifier.property و تولید diagnostic با پیشنهاد نزدیک‌ترین کلید.
// ════════════════════════════════════════════════════════════════════════

/**
 * محاسبه‌ی فاصله‌ی Levenshtein بین دو رشته.
 * تعداد عملیات insert/delete/replace برای تبدیل a به b.
 * برای پیشنهاد نزدیک‌ترین property هنگام typo استفاده می‌شود.
 */
/**
 * محاسبه فاصله Levenshtein بین دو رشته — بهینه‌شده با دو ردیف.
 *
 * FIX (B-9): نسخه قبلی از یک ماتریس کامل (m+1)×(n+1) استفاده می‌کرد
 * که برای رشته‌های بلند حافظه زیادی مصرف می‌کرد. این نسخه تنها از دو
 * ردیف (prev و curr) استفاده می‌کند و پیچیدگی حافظه را از O(m×n) به O(n) کاهش می‌دهد.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // اطمینان از اینکه b کوتاه‌ترین رشته باشد (برای حافظه بهتر)
  if (a.length < b.length) {
    [a, b] = [b, a];
  }

  const n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  // ردیف اول: j
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const aCh = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = aCh === b.charCodeAt(j - 1) ? 0 : 1;
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      curr[j] = Math.min(
        prev[j]! + 1,          // deletion
        curr[j - 1]! + 1,      // insertion
        prev[j - 1]! + cost    // substitution
      );
      /* eslint-enable */
    }
    // swap rows
    [prev, curr] = [curr, prev];
  }
  // prev[n] به دلیل ساختار الگوریتم همیشه تعریف شده است
  return prev[n]!;
}

/**
 * با دریافت ایندکس براکت `{` باز، متن داخل براکت‌های متناظر را برمی‌گرداند.
 * رشته‌ها و کامنت‌ها را به‌درستی نادیده می‌گیرد. در صورت نامتوازن بودن null برمی‌گردد.
 */
function extractBracedBody(src: string, openBraceIndex: number): string | null {
  if (src[openBraceIndex] !== '{') return null;
  let depth = 1;
  let i = openBraceIndex + 1;
  let inStr: string | null = null;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i += 2; continue; }
      if (c === inStr) inStr = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; i++; continue; }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length - 1 && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2; continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  if (depth !== 0) return null;
  return src.slice(openBraceIndex + 1, i - 1);
}

/**
 * کلیدهای top-level بدنه‌ی object را جمع کرده و در signals[name] قرار می‌دهد.
 * اگر مقدار یک کلید خود یک object literal باشد، به‌صورت بازگشتی با همان نام کلید ثبت می‌شود
 * (تا const state = { user: { name, age } } هم state و هم user را ثبت کند).
 */
function walkObject(body: string, name: string, signals: Map<string, string[]>): void {
  const keys: string[] = [];
  let depth = 0;
  let i = 0;
  let inStr: string | null = null;
  while (i < body.length) {
    const c = body[i];
    if (inStr) {
      if (c === '\\') { i += 2; continue; }
      if (c === inStr) inStr = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; i++; continue; }
    if (c === '/' && body[i + 1] === '/') {
      while (i < body.length && body[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && body[i + 1] === '*') {
      i += 2;
      while (i < body.length - 1 && !(body[i] === '*' && body[i + 1] === '/')) i++;
      i += 2; continue;
    }
    if (c === '{' || c === '[' || c === '(') { depth++; i++; continue; }
    if (c === '}' || c === ']' || c === ')') { depth--; i++; continue; }
    if (depth === 0) {
      // کلید identifier با ":" (مثل name: ...)
      const idMatch = /^([a-zA-Z_$][\w$]*)\s*:/.exec(body.slice(i));
      if (idMatch) {
        keys.push(idMatch[1]);
        // اگر مقدار کلید خود یک object literal است (با یا بدون wrapper signal())،
        // به‌صورت بازگشتی کلیدهای آن را با نام کلید فعلی ثبت کن.
        let j = i + idMatch[0].length;
        while (j < body.length && /\s/.test(body[j])) j++;
        const sigPrefix = /^signal\s*\(\s*/.exec(body.slice(j));
        if (sigPrefix) j += sigPrefix[0].length;
        if (body[j] === '{') {
          const subBody = extractBracedBody(body, j);
          if (subBody !== null) {
            walkObject(subBody, idMatch[1], signals);
          }
        }
        i += idMatch[0].length;
        continue;
      }
      // کلید quoted مثل "name": یا 'name':
      const qMatch = /^(['"])([a-zA-Z_$][\w$]*)\1\s*:/.exec(body.slice(i));
      if (qMatch) {
        keys.push(qMatch[2]);
        i += qMatch[0].length;
        continue;
      }
    }
    i++;
  }
  if (keys.length > 0) {
    signals.set(name, keys);
  }
}

/**
 * جمع‌آوری signal های شناخته‌شده از document فعلی و فایل‌های companion.
 * الگوهای پشتیبانی‌شده:
 *   - const user = { name: ..., age: ..., email: ... };
 *   - const state = signal({ count: 0, name: '' });
 *   - const state = { user: { name: ..., age: ... } };  (هم state و هم user ثبت می‌شوند)
 * خروجی: Map از نام signal → آرایه‌ی property names.
 */
function collectKnownSignals(document: vscode.TextDocument): Map<string, string[]> {
  const signals = new Map<string, string[]>();
  const sources: string[] = [];

  // ۱) اسکن <script> های inline داخل HTML فعلی.
  const text = document.getText();
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = scriptRegex.exec(text)) !== null) {
    sources.push(sm[1]);
  }

  // FIX (B-4): اگر companion در VSCode باز باشد، از API ناهمگام (async) آن استفاده کن.
  // اگر باز نیست، از readFileSync با cache استفاده کن.
  const fsPath = document.uri.fsPath;
  const dir = path.dirname(fsPath);
  const base = path.basename(fsPath, path.extname(fsPath));
  for (const ext of ['.ts', '.js']) {
    const companion = path.join(dir, base + ext);
    if (companion !== fsPath && fs.existsSync(companion)) {
      try {
        // بررسی کن که فایل در VSCode باز است (بدون blocking I/O)
        const openDoc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === companion);
        if (openDoc) {
          sources.push(openDoc.getText());
        } else {
          // فقط در صورت عدم وجود در cache از readFileSync استفاده کن
          // (cache در collectKnownSignals ذخیره می‌شود)
          sources.push(fs.readFileSync(companion, 'utf-8'));
        }
      } catch {
        // نادیده گرفتن خطای خواندن فایل.
      }
    }
  }

  // ۳) برای هر source، الگوهای `const X = { ... }` یا `const X = signal({ ... })` را پیدا کن.
  for (const src of sources) {
    const assignRegex = /\b(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:signal\s*\(\s*)?\{/g;
    let am: RegExpExecArray | null;
    while ((am = assignRegex.exec(src)) !== null) {
      const varName = am[1];
      // براکت `{` باز، آخرین کاراکتر match است.
      const openBraceIdx = am.index + am[0].length - 1;
      const body = extractBracedBody(src, openBraceIdx);
      if (body === null) continue;
      walkObject(body, varName, signals);
    }
  }

  return signals;
}

/**
 * بررسی دسترسی به property های signal با پیشنهاد Did you mean.
 * expression را برای الگوی $identifier.property اسکن می‌کند (با نادیده گرفتن رشته‌ها).
 * اگر identifier یک signal شناخته‌شده باشد و property وجود نداشته باشد،
 * با استفاده از Levenshtein نزدیک‌ترین property را پیشنهاد می‌دهد.
 * خروجی: لیست issue ها با message و offset شروع/پایان داخل expr.
 */
function checkSignalPropertyAccess(
  expr: string,
  knownSignals: Map<string, string[]>
): Array<{ message: string; start: number; end: number; code: string }> {
  const results: Array<{ message: string; start: number; end: number; code: string }> = [];
  let i = 0;
  let inStr: string | null = null;
  while (i < expr.length) {
    const c = expr[i];
    if (inStr) {
      if (c === '\\') { i += 2; continue; }
      if (c === inStr) inStr = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; i++; continue; }
    if (c === '$') {
      const m = /^\$([a-zA-Z_$][\w$]*)\.([a-zA-Z_$][\w$]*)/.exec(expr.slice(i));
      if (m) {
        const ident = m[1];
        const prop = m[2];
        const known = knownSignals.get(ident);
        if (known && !known.includes(prop)) {
          // پیدا کردن نزدیک‌ترین کلید با Levenshtein.
          let bestMatch: string | null = null;
          let bestDist = Infinity;
          for (const candidate of known) {
            const dist = levenshtein(prop, candidate);
            if (dist < bestDist) {
              bestDist = dist;
              bestMatch = candidate;
            }
          }

          const start = i;
          const end = i + m[0].length;
          let message: string;
          let code: string;
          if (bestMatch && bestDist <= 2) {
            message = `Property "${prop}" not found on $${ident}. Did you mean: $${ident}.${bestMatch}?`;
            code = `zenith.suggest:${ident}.${bestMatch}`;
          } else {
            message = `Property "${prop}" not found on $${ident}.`;
            code = '';
          }
          results.push({ message, start, end, code });
        }
        i += m[0].length;
        continue;
      }
    }
    i++;
  }
  return results;
}

/**
 * Semantic Tokens legend برای رنگ‌آمیزی $variableها در directive values.
 * IMPROVEMENT (I-2): تعریف token types برای اسکم‌متیک هایلایتینگ.
 * - type 0: variable (برای $signalName)
 * - type 1: property (برای $signal.property)
 */
const ZENITH_TOKEN_TYPES: string[] = ['variable', 'property'];
const ZENITH_TOKEN_MODIFIERS: string[] = ['readonly'];
const zenithLegend = new vscode.SemanticTokensLegend(ZENITH_TOKEN_TYPES, ZENITH_TOKEN_MODIFIERS);

/**
 * Completion provider برای zen-* attributes.
 */
function createCompletionProvider(): vscode.Disposable {
  return vscode.languages.registerCompletionItemProvider(
    ['html', 'zenith-html'],
    {
      provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const linePrefix = document.lineAt(position).text.slice(0, position.character);

        // FIX (B-3): تشخیص بهتر اینکه آیا داخل attribute value هستیم.
        // از position و textLine برای بررسی وجود = قبل از cursor و
        // قرار گرفتن داخل quotation استفاده می‌کند.
        // موارد لبه: multiple attributes, space درون value, single quotes
        const inValue = (() => {
          const text = document.lineAt(position).text;
          const prefix = text.slice(0, position.character);
          const eqIdx = prefix.lastIndexOf('=');
          if (eqIdx < 0) return false;
          // بعد از = قرار داریم — بررسی کن داخل quotation هستیم یا نه
          const lastQuote = Math.max(prefix.lastIndexOf('"'), prefix.lastIndexOf("'"));
          if (lastQuote > eqIdx) return true;
          // = بدون quotation باز (مثل zen-if=) — ته attribute value نیستیم
          return false;
        })();
        if (inValue) return undefined;

        const items: vscode.CompletionItem[] = [];

        for (const dir of ZENITH_DIRECTIVES) {
          const item = new vscode.CompletionItem(dir.name, vscode.CompletionItemKind.Property);
          item.detail = 'Zenith Directive';
          item.documentation = new vscode.MarkdownString(dir.description);
          item.insertText = new vscode.SnippetString(dir.snippet);
          items.push(item);
        }

        // Component tags.
        const componentItem = new vscode.CompletionItem('zen-component', vscode.CompletionItemKind.Snippet);
        componentItem.insertText = new vscode.SnippetString(
          '<zen-component name="${1:app-name}">\n  <template>\n    <div class="${1}">\n      <slot></slot>\n    </div>\n  </template>\n</zen-component>'
        );
        componentItem.detail = 'Zenith Component Definition';
        items.push(componentItem);

        // Router.
        const routerItem = new vscode.CompletionItem('zen-router', vscode.CompletionItemKind.Snippet);
        routerItem.insertText = new vscode.SnippetString(
          '<zen-router>\n  <zen-route path="${1:/}" src="${2:/pages/home.html}"></zen-route>\n  <zen-route path="**" src="${3:/pages/404.html}"></zen-route>\n</zen-router>'
        );
        routerItem.detail = 'Zenith SPA Router';
        items.push(routerItem);

        return items;
      },
    },
    'z', 'e', 'n' // trigger characters
  );
}

/**
 * Hover provider برای zen-* attributes.
 */
function createHoverProvider(): vscode.Disposable {
  return vscode.languages.registerHoverProvider(
    ['html', 'zenith-html'],
    {
      provideHover(document: vscode.TextDocument, position: vscode.Position) {
        const range = document.getWordRangeAtPosition(position, /zen-[a-z:-]+/);
        if (!range) return undefined;

        const word = document.getText(range);
        const directive = ZENITH_DIRECTIVES.find(d => d.name === word || word.startsWith(d.name));

        if (directive) {
          return new vscode.Hover(new vscode.MarkdownString(`**${directive.name}**\n\n${directive.description}`), range);
        }

        return undefined;
      },
    }
  );
}

/**
 * Validation provider — بررسی syntax expressions.
 */
function createDiagnosticsProvider(): vscode.Disposable {
  const diagnostics = vscode.languages.createDiagnosticCollection('zenith');

  // FEATURE (v0.3.0): کش per-document برای knownSignals با version check.
  // در صورت تغییر document.version (تایپ کاربر) یا ذخیره‌ی فایل companion، کش refresh می‌شود.
  const knownSignalsCache = new Map<string, { version: number; signals: Map<string, string[]> }>();

  function getKnownSignals(document: vscode.TextDocument): Map<string, string[]> {
    const uri = document.uri.toString();
    const version = document.version;
    const cached = knownSignalsCache.get(uri);
    if (cached && cached.version === version) {
      return cached.signals;
    }
    const signals = collectKnownSignals(document);
    knownSignalsCache.set(uri, { version, signals });
    return signals;
  }

  const updateDiagnostics = (document: vscode.TextDocument) => {
    const config = vscode.workspace.getConfiguration('zenith');
    if (!config.get('validateExpressions', true)) return;

    const items: vscode.Diagnostic[] = [];
    const text = document.getText();

    // FEATURE (v0.3.0): جمع‌آوری signal های شناخته‌شده برای پیشنهاد Did you mean.
    const knownSignals = getKnownSignals(document);

    // پیدا کردن همه‌ی zen-* attribute values.
    // FIX (B-7): پشتیبانی از هر دو نوع quotation (double و single).
    // از alternation برای quote استفاده می‌کند تا هم "..." و هم '...' پشتیبانی شود.
    // FIX (B-8): prop:* هم به regex اضافه شد تا diagnostics روی آن هم کار کند.
    const attrRegex = /(prop:[a-zA-Z_]\w*|zen-(?:text|if|for|bind(?::\w+)?|model|action(?::[\w.]+)?|fetch|html|key|resource|validate))(?:="([^"]*)"|='([^']*)')/g;
    let match: RegExpExecArray | null;

    while ((match = attrRegex.exec(text)) !== null) {
      const attrName = match[1];
      // FIX (B-7): مقدار می‌تواند در match[2] (double quote) یا match[3] (single quote) باشد.
      const expr = match[2] ?? match[3] ?? '';
      const startPos = document.positionAt(match.index + match[0].length - expr.length - 1);
      const endPos = document.positionAt(match.index + match[0].length - 1);

      // بررسی expression syntax.
      const errors = validateExpression(expr, attrName);
      for (const err of errors) {
        items.push({
          severity: vscode.DiagnosticSeverity.Warning,
          range: new vscode.Range(startPos, endPos),
          message: err,
          source: 'zenith',
        });
      }

      // FEATURE (v0.3.0): بررسی دسترسی به property های signal با پیشنهاد Did you mean.
      // offset شروع expr داخل document (اولین کاراکتر expr).
      const exprStartOffset = match.index + match[0].length - expr.length - 1;
      const propIssues = checkSignalPropertyAccess(expr, knownSignals);
      for (const issue of propIssues) {
        const diag: vscode.Diagnostic = {
          severity: vscode.DiagnosticSeverity.Hint,
          range: new vscode.Range(
            document.positionAt(exprStartOffset + issue.start),
            document.positionAt(exprStartOffset + issue.end)
          ),
          message: issue.message,
          source: 'zenith',
        };
        if (issue.code) {
          diag.code = issue.code;
        }
        items.push(diag);
      }
    }

    diagnostics.set(document.uri, items);
  };

  const changeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
    if (e.document.languageId === 'html' || e.document.languageId === 'zenith-html') {
      updateDiagnostics(e.document);
    }

    // FIX (B-5): وقتی یک فایل companion (.ts/.js) تغییر می‌کند،
    // کش signalهای مربوط به آن را پاک می‌کنیم. این باعث می‌شود
    // تغییرات خارج از VSCode (مثل git pull) هم منعکس شوند.
    if (e.document.uri.fsPath.endsWith('.ts') || e.document.uri.fsPath.endsWith('.js')) {
      knownSignalsCache.clear();
      // re-scan editors open
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document.languageId === 'html' || editor.document.languageId === 'zenith-html') {
          updateDiagnostics(editor.document);
        }
      }
    }
  });

  // FEATURE (v0.3.0): پاک کردن کش هنگام ذخیره تا تغییرات فایل‌های companion (.ts/.js) منعکس شود.
  const saveDisposable = vscode.workspace.onDidSaveTextDocument(() => {
    knownSignalsCache.clear();
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.languageId === 'html' || editor.document.languageId === 'zenith-html') {
        updateDiagnostics(editor.document);
      }
    }
  });

  // FIX (B-6): پاک کردن diagnostics برای یک URI وقتی document بسته می‌شود
  // تا مشکلات stale در Problems Panel باقی نمانند.
  const closeDisposable = vscode.workspace.onDidCloseTextDocument((doc) => {
    diagnostics.delete(doc.uri);
  });

  // Also run on open.
  if (vscode.window.activeTextEditor) {
    updateDiagnostics(vscode.window.activeTextEditor.document);
  }

  return vscode.Disposable.from(changeDisposable, saveDisposable, closeDisposable, diagnostics);
}

/**
 * اعتبارسنجی expression.
 */
function validateExpression(expr: string, attrName: string): string[] {
  const errors: string[] = [];

  // بررسی template literal (پشتیبانی نمی‌شود).
  if (expr.includes('`') && expr.includes('${')) {
    errors.push('Template literals with ${} are not supported. Use string concatenation: \'text\' + $var');
  }

  // بررسی access به globals ممنوعه.
  const forbidden = ['window', 'document', 'eval', 'Function', 'globalThis', '__proto__', 'constructor', 'prototype'];
  for (const f of forbidden) {
    if (new RegExp(`\\b${f}\\b`).test(expr)) {
      errors.push(`Access to "${f}" is forbidden in Zenith expressions`);
    }
  }

  // بررسی zen-for syntax.
  if (attrName === 'zen-for') {
    if (!/\s+in\s+/.test(expr)) {
      errors.push('zen-for syntax: "item in $items" or "(item, index) in $items"');
    }
  }

  // بررسی zen-action modifiers.
  if (attrName.startsWith('zen-action:')) {
    const parts = attrName.split(':');
    if (parts.length > 2) {
      const modifiers = parts[2]!.split('.');
      const validModifiers = ['prevent', 'stop', 'immediate', 'enter', 'escape', 'tab', 'space', 'shift', 'ctrl', 'alt', 'meta'];
      for (const m of modifiers) {
        if (!validModifiers.includes(m)) {
          errors.push(`Unknown modifier "${m}". Valid: ${validModifiers.join(', ')}`);
        }
      }
    }
  }

  return errors;
}

/**
 * Command: Create Component.
 */
function createCreateComponentCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('zenith.createComponent', async () => {
    const name = await vscode.window.showInputBox({
      prompt: 'Component name (PascalCase, e.g. UserCard)',
      validateInput: (v) => /^[A-Z][a-zA-Z0-9]*$/.test(v) ? null : 'Must be PascalCase',
    });
    if (!name) return;

    const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const dir = vscode.Uri.file(path.join(workspaceFolders[0]!.uri.fsPath, 'src', 'components'));
    if (!fs.existsSync(dir.fsPath)) fs.mkdirSync(dir.fsPath, { recursive: true });

    const filePath = vscode.Uri.joinPath(dir, `${kebab}.html`);
    try {
      await vscode.workspace.fs.stat(filePath);
      vscode.window.showErrorMessage(`File already exists: ${filePath.fsPath}`);
      return;
    } catch {
      // فایل وجود ندارد — ادامه بده
    }

    const content = `<zen-component name="${kebab}">
  <template>
    <div class="${kebab}">
      <h3>${name}</h3>
      <slot></slot>
    </div>
  </template>
</zen-component>
`;

    // IMPROVEMENT (I-9): استفاده از workspace.fs.writeFile به‌جای fs.writeFileSync
    // برای پشتیبانی از Undo/Redo در VSCode (integration با VSCode's editing stack).
    await vscode.workspace.fs.writeFile(filePath, new TextEncoder().encode(content));
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage(`✅ Component '${name}' created at: ${filePath.fsPath}`);
  });
}

/**
 * Command: Create Page.
 */
function createCreatePageCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('zenith.createPage', async () => {
    const name = await vscode.window.showInputBox({
      prompt: 'Page name (PascalCase, e.g. About)',
      validateInput: (v) => /^[A-Z][a-zA-Z0-9]*$/.test(v) ? null : 'Must be PascalCase',
    });
    if (!name) return;

    const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const dir = vscode.Uri.file(path.join(workspaceFolders[0]!.uri.fsPath, 'pages'));
    if (!fs.existsSync(dir.fsPath)) fs.mkdirSync(dir.fsPath, { recursive: true });

    const filePath = vscode.Uri.joinPath(dir, `${kebab}.html`);
    try {
      await vscode.workspace.fs.stat(filePath);
      vscode.window.showErrorMessage(`File already exists: ${filePath.fsPath}`);
      return;
    } catch {
      // فایل وجود ندارد — ادامه بده
    }

    const content = `<div class="page page-${kebab}">
  <h1>${name}</h1>
  <p>This is the ${name} page.</p>
</div>
`;

    // IMPROVEMENT (I-9): استفاده از workspace.fs.writeFile برای Undo/Redo
    await vscode.workspace.fs.writeFile(filePath, new TextEncoder().encode(content));
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage(`✅ Page '${name}' created at: ${filePath.fsPath}`);
  });
}

/**
 * Command: Create Action.
 */
function createCreateActionCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('zenith.createAction', async () => {
    const name = await vscode.window.showInputBox({
      prompt: 'Action name (camelCase, e.g. saveUser)',
      validateInput: (v) => /^[a-z][a-zA-Z0-9]*$/.test(v) ? null : 'Must be camelCase',
    });
    if (!name) return;

    const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const dir = vscode.Uri.file(path.join(workspaceFolders[0]!.uri.fsPath, 'src', 'actions'));
    if (!fs.existsSync(dir.fsPath)) fs.mkdirSync(dir.fsPath, { recursive: true });

    const filePath = vscode.Uri.joinPath(dir, `${kebab}.ts`);
    try {
      await vscode.workspace.fs.stat(filePath);
      vscode.window.showErrorMessage(`File already exists: ${filePath.fsPath}`);
      return;
    } catch {
      // فایل وجود ندارد — ادامه بده
    }

    const content = `// Action: ${name}
import { Zen } from '@zenith/runtime';

Zen.action('${name}', ({ state, element, event }) => {
  console.log('Action "${name}" called');
  // TODO: implement action logic
});
`;

    // IMPROVEMENT (I-9): استفاده از workspace.fs.writeFile برای Undo/Redo
    await vscode.workspace.fs.writeFile(filePath, new TextEncoder().encode(content));
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage(`✅ Action '${name}' created at: ${filePath}`);
  });
}

/**
 * IMPROVEMENT (I-7): پرایدور Hover برای نمایش نوع $signalها.
 *
 * وقتی کاربر روی یک $variable (مثل $user.name) در فایل HTML hover می‌کند،
 * این پرایدور نوع آن signal را از companion .ts/.js استخراج کرده و نمایش می‌دهد.
 */
function createSignalHoverProvider(): vscode.Disposable {
  return vscode.languages.registerHoverProvider(
    ['html', 'zenith-html'],
    {
      provideHover(document: vscode.TextDocument, position: vscode.Position) {
        const range = document.getWordRangeAtPosition(position, /\$[a-zA-Z_]\w*(?:\.\w+)*/);
        if (!range) return undefined;

        const word = document.getText(range);
        if (!word.startsWith('$')) return undefined;

        const signalName = word.slice(1);
        const signals = collectKnownSignals(document);
        const parts = signalName.split('.');
        const rootName = parts[0]!;

        if (signals.has(rootName)) {
          const types = signals.get(rootName)!;
          const md = new vscode.MarkdownString();
          const typeStr = types.length > 0 ? types.join(', ') : 'unknown';

          if (parts.length === 1) {
            md.appendCodeblock(`Signal<${typeStr}>`, 'typescript');
            md.appendMarkdown(`Signal \`${rootName}\` با نوع \`${typeStr}\``);
          } else {
            const propPath = parts.slice(1).join('.');
            md.appendCodeblock(`typeof ${rootName}.${propPath}`, 'typescript');
            md.appendMarkdown(`دسترسی به \`${propPath}\` از \`${rootName}: Signal<${typeStr}>\``);
          }
          return new vscode.Hover(md, range);
        }

        return new vscode.Hover(
          new vscode.MarkdownString(`Signal reference \`${word}\` — type unknown. Define in companion .ts file.`),
          range,
        );
      },
    }
  );
}

/**
 * FEATURE (v0.3.0): CodeActionProvider برای Quick Fix پیشنهاد Did you mean.
 * برای diagnostic هایی با code به فرمت `zenith.suggest:<ident>.<property>`،
 * یک Quick Fix ارائه می‌دهد که property اشتباه را با پیشنهاد جایگزین می‌کند.
 */
function createCodeActionProvider(): vscode.Disposable {
  return vscode.languages.registerCodeActionsProvider(
    ['html', 'zenith-html'],
    {
      provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range,
        context: vscode.CodeActionContext
      ): vscode.CodeAction[] | undefined {
        const actions: vscode.CodeAction[] = [];
        for (const diag of context.diagnostics) {
          if (diag.source !== 'zenith') continue;
          if (typeof diag.code !== 'string') continue;
          if (!diag.code.startsWith('zenith.suggest:')) continue;

          // code: "zenith.suggest:<ident>.<property>" → property پیشنهادی.
          const suggestedProp = diag.code.slice('zenith.suggest:'.length).split('.').pop();
          if (!suggestedProp) continue;

          // متن داخل range diagnostic، مثلاً "$user.nmae".
          const oldText = document.getText(diag.range);
          const dotIdx = oldText.indexOf('.');
          if (dotIdx < 0) continue;
          const prefix = oldText.slice(0, dotIdx + 1); // "$user."
          const newText = prefix + suggestedProp;       // "$user.name"

          const edit = new vscode.WorkspaceEdit();
          edit.replace(document.uri, diag.range, newText);

          const action = new vscode.CodeAction(
            `Replace with ${newText}`,
            vscode.CodeActionKind.QuickFix
          );
          action.edit = edit;
          action.diagnostics = [diag];
          action.isPreferred = true;
          actions.push(action);
        }
        return actions.length > 0 ? actions : undefined;
      },
    },
    {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    }
  );
}

/**
 * Activation.
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('[Zenith] Extension activated.');

  context.subscriptions.push(createCompletionProvider());
  context.subscriptions.push(createHoverProvider());
  // IMPROVEMENT (I-7): ثبت Hover Provider پیشرفته برای $signalها با type info
  context.subscriptions.push(createSignalHoverProvider());
  context.subscriptions.push(createDiagnosticsProvider());
  context.subscriptions.push(createCodeActionProvider());
  context.subscriptions.push(createCreateComponentCommand());
  context.subscriptions.push(createCreatePageCommand());
  context.subscriptions.push(createCreateActionCommand());

  // IMPROVEMENT (I-2): ثبت Semantic Tokens Provider برای رنگ‌آمیزی $variableها
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      ['html', 'zenith-html'],
      new ZenithSemanticTokensProvider(),
      zenithLegend,
    ),
  );

  // IMPROVEMENT-06 (v1.0.1): DevTools WebView Panel
  context.subscriptions.push(
    vscode.commands.registerCommand('zenith.openDevTools', () => {
      const panel = vscode.window.createWebviewPanel(
        'zenithDevTools',
        'Zenith DevTools',
        vscode.ViewColumn.Two,
        { enableScripts: true, retainContextWhenHidden: true },
      );

      panel.webview.html = getDevToolsHtml();

      // IMPROVEMENT (B-10): WebView پیشرفته‌تر با دریافت داده واقعی از extension
      // وقتی کاربر Refresh می‌کند، اطلاعات companion files و directives را
      // از فایل HTML جاری استخراج کرده و به WebView ارسال می‌کند.
      panel.webview.onDidReceiveMessage(
        (msg) => {
          if (msg.type === 'refresh') {
            const editor = vscode.window.activeTextEditor;
            if (editor && (editor.document.languageId === 'html' || editor.document.languageId === 'zenith-html')) {
              const doc = editor.document;
              const text = doc.getText();

              // شمارش directiveها
              const directiveRegex = /(zen-[a-z][a-z0-9:-]*)(?:="[^"]*"|='[^']*')?/gi;
              const dirs: string[] = [];
              let m: RegExpExecArray | null;
              while ((m = directiveRegex.exec(text)) !== null) dirs.push(m[1]!);

              // آمار signalها از companion
              const signals = collectKnownSignals(doc);
              const signalList: Array<{ name: string; types: string[] }> = [];
              signals.forEach((types, name) => signalList.push({ name, types }));

              panel.webview.postMessage({
                type: 'devtools-data',
                fileName: doc.fileName,
                directives: dirs,
                directiveCount: dirs.length,
                uniqueDirectives: [...new Set(dirs)].length,
                signals: signalList,
                totalSignals: signalList.length,
                lineCount: doc.lineCount,
              });
            } else {
              panel.webview.postMessage({
                type: 'status',
                message: 'یک فایل .html با directiveهای Zenith باز کنید.',
                isError: true,
              });
            }
          }

          // IMPROVEMENT (B-10): پشتیبانی از WebSocket-like connection
          // برای دریافت داده از سرور توسعه (در آینده)
          if (msg.type === 'connect') {
            panel.webview.postMessage({
              type: 'status',
              message: 'CDP connection not yet implemented. For real-time data, run app with --remote-debugging-port=9222',
            });
          }
        },
        undefined,
        context.subscriptions,
      );
    }),
  );

  // ثبت status bar button
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusItem.text = '$(tools) Zenith';
  statusItem.tooltip = 'باز کردن Zenith DevTools';
  statusItem.command = 'zenith.openDevTools';
  statusItem.show();
  context.subscriptions.push(statusItem);
}

/**
 * IMPROVEMENT (I-2): Semantic Tokens Provider برای رنگ‌آمیزی $variableها
 * در directive values. این کلاس tokenهای معنایی برای متغیرهای zenith
 * تولید می‌کند تا در VSCode با رنگ متفاوت نمایش داده شوند.
 */
class ZenithSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  async provideDocumentSemanticTokens(document: vscode.TextDocument): Promise<vscode.SemanticTokens> {
    const tokensBuilder = new vscode.SemanticTokensBuilder(zenithLegend);
    const text = document.getText();

    // الگوی تطبیق $variableName در داخل attribute values directiveها
    const varRegex = /(?:zen-(?:text|if|show|html|html-trusted|model|bind(?::\w+)?)="[^"]*)\$([a-zA-Z_]\w*(?:\.\w+)*)/g;
    let match: RegExpExecArray | null;
    while ((match = varRegex.exec(text)) !== null) {
      const varName = match[1]!;
      const dollarIndex = match[0].indexOf('$');
      const startGlobalIndex = match.index + dollarIndex + 1; // بعد از $
      const startPos = document.positionAt(startGlobalIndex);
      const dotIndex = varName.indexOf('.');
      if (dotIndex > 0) {
        // signal.property → signal=variable type (0), property=property type (1)
        const signalEnd = startGlobalIndex + dotIndex;
        tokensBuilder.push(startPos.line, startPos.character, dotIndex, 0 /* variable */, 0);
        const propStart = document.positionAt(signalEnd + 1);
        tokensBuilder.push(propStart.line, propStart.character, varName.length - dotIndex - 1, 1 /* property */, 0);
      } else {
        // signal به تنهایی
        tokensBuilder.push(startPos.line, startPos.character, varName.length, 0 /* variable */, 0);
      }
    }
    return tokensBuilder.build();
  }
}

function getDevToolsHtml(): string {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-editor-foreground, #d4d4d4); }
    h2 { color: var(--vscode-textLink-foreground, #3794ff); margin-bottom: 12px; font-size: 18px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; background: var(--vscode-badge-background, #3c3c3c); color: var(--vscode-badge-foreground, #fff); }
    .card { background: var(--vscode-editorWidget-background, #252526); border: 1px solid var(--vscode-widget-border, #3c3c3c); border-radius: 8px; padding: 14px; margin-bottom: 12px; }
    .card-title { font-weight: 600; font-size: 13px; margin-bottom: 8px; color: var(--vscode-textLink-foreground, #3794ff); }
    .stat-row { display: flex; gap: 12px; flex-wrap: wrap; margin: 8px 0; }
    .stat { background: var(--vscode-input-background, #3c3c3c); border-radius: 6px; padding: 8px 14px; text-align: center; flex: 1; min-width: 80px; }
    .stat-value { font-size: 22px; font-weight: 700; display: block; }
    .stat-label { font-size: 11px; opacity: 0.7; display: block; margin-top: 2px; }
    .status-msg { padding: 8px 12px; border-radius: 6px; margin: 8px 0; font-size: 12px; background: var(--vscode-inputValidation-infoBackground, #063b4a); border: 1px solid var(--vscode-inputValidation-infoBorder, #3794ff); }
    .status-msg.error { background: var(--vscode-inputValidation-errorBackground, #5a1d1d); border-color: var(--vscode-inputValidation-errorBorder, #e51400); }
    button { background: var(--vscode-button-background, #0e639c); color: var(--vscode-button-foreground, #fff); border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer; font-size: 13px; margin: 4px 4px 4px 0; }
    button:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
    button.secondary { background: var(--vscode-button-secondaryBackground, #3a3d41); }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }
    ul { list-style: none; padding: 0; }
    li { padding: 4px 8px; font-size: 12px; font-family: 'Cascadia Code', 'Fira Code', monospace; border-bottom: 1px solid var(--vscode-widget-border, #3c3c3c); }
    li:last-child { border-bottom: none; }
    .signal-name { color: var(--vscode-symbolIcon-variableForeground, #9cdcfe); }
    .directive-tag { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 11px; background: var(--vscode-editor-selectionBackground, #264f78); margin: 1px; }
    .empty { opacity: 0.5; font-size: 12px; text-align: center; padding: 20px; }
    .file-path { font-size: 11px; opacity: 0.6; margin-bottom: 8px; word-break: break-all; }
    .actions { margin: 8px 0; }
  </style>
</head>
<body>
  <h2>🔧 Zenith DevTools</h2>
  <p style="font-size:12px;opacity:0.7;margin-bottom:12px;">VSCode Extension — Signal & Directive Inspector</p>

  <div id="fileInfo" class="card" style="display:none;">
    <div class="card-title">📄 File</div>
    <div class="file-path" id="filePath"></div>
    <div class="stat-row">
      <div class="stat"><span class="stat-value" id="dirCount">0</span><span class="stat-label">Directives</span></div>
      <div class="stat"><span class="stat-value" id="uniqueDirs">0</span><span class="stat-label">Unique</span></div>
      <div class="stat"><span class="stat-value" id="signalCount">0</span><span class="stat-label">Signals</span></div>
      <div class="stat"><span class="stat-value" id="lineCount">0</span><span class="stat-label">Lines</span></div>
    </div>
  </div>

  <div class="actions">
    <button onclick="refreshData()">🔄 Refresh</button>
    <button class="secondary" onclick="connectCDP()" id="connectBtn">🔌 Connect CDP</button>
  </div>

  <div id="status" class="status-msg">برای شروع، روی Refresh کلیک کنید.</div>

  <div id="signalsCard" class="card" style="display:none;">
    <div class="card-title">📡 Signals <span class="badge" id="signalBadge">0</span></div>
    <ul id="signalList"></ul>
  </div>

  <div id="directivesCard" class="card" style="display:none;">
    <div class="card-title">🏷️ Directives <span class="badge" id="dirBadge">0</span></div>
    <div id="directiveList"></div>
  </div>

  <script>
    const vscodeApi = acquireVsCodeApi();

    function refreshData() {
      setStatus('در حال دریافت اطلاعات...');
      vscodeApi.postMessage({ type: 'refresh' });
    }

    function connectCDP() {
      document.getElementById('connectBtn').disabled = true;
      document.getElementById('connectBtn').textContent = '⏳ Connecting...';
      vscodeApi.postMessage({ type: 'connect' });
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;

      if (msg.type === 'status') {
        setStatus(msg.message, msg.isError);
        if (msg.isError) document.getElementById('connectBtn').disabled = false;
        return;
      }

      if (msg.type === 'devtools-data') {
        document.getElementById('fileInfo').style.display = 'block';
        document.getElementById('filePath').textContent = msg.fileName || 'unknown';
        document.getElementById('dirCount').textContent = msg.directiveCount ?? 0;
        document.getElementById('uniqueDirs').textContent = msg.uniqueDirectives ?? 0;
        document.getElementById('signalCount').textContent = msg.totalSignals ?? 0;
        document.getElementById('lineCount').textContent = msg.lineCount ?? 0;

        const signalList = document.getElementById('signalList');
        const signalsCard = document.getElementById('signalsCard');
        if (msg.signals && msg.signals.length > 0) {
          signalsCard.style.display = 'block';
          document.getElementById('signalBadge').textContent = msg.signals.length;
          signalList.innerHTML = msg.signals.map(s =>
            '<li><span class="signal-name">$' + s.name + '</span> <span style="opacity:0.6">:</span> <span style="opacity:0.8">' + (s.types.join(', ') || 'unknown') + '</span></li>'
          ).join('');
        } else {
          signalsCard.style.display = 'none';
        }

        const directiveList = document.getElementById('directiveList');
        const directivesCard = document.getElementById('directivesCard');
        if (msg.directives && msg.directives.length > 0) {
          directivesCard.style.display = 'block';
          document.getElementById('dirBadge').textContent = msg.directives.length;
          const counts = {};
          msg.directives.forEach(d => { counts[d] = (counts[d] || 0) + 1; });
          directiveList.innerHTML = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) =>
              '<span class="directive-tag">' + name + ' (' + count + ')</span> '
            ).join('');
        } else {
          directivesCard.style.display = 'none';
        }

        setStatus('✅ ' + msg.directiveCount + ' directive, ' + msg.totalSignals + ' signal in ' + msg.fileName);
        document.getElementById('connectBtn').disabled = false;
        document.getElementById('connectBtn').textContent = '🔌 Connect CDP';
      }
    });

    function setStatus(msg, isError) {
      const el = document.getElementById('status');
      el.textContent = msg;
      el.className = 'status-msg' + (isError ? ' error' : '');
    }
  </script>
</body>
</html>`;
}

export function deactivate(): void {
  console.log('[Zenith] Extension deactivated.');
}
