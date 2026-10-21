// packages/compiler/src/template-typecheck.ts
//
// #111 — قرارداد اختیاری state type/schema برای templateها (type-safe opt-in).
//
// موتور مشترک compiler و LSP: هر دو `analyzeTemplateTypes` را مصرف می‌کنند
// (compiler در `compileTemplate` با `stateTypes`، و language-server در
// `computeDiagnostics` با همان گزینه). بدون `stateTypes` موتور هیچ کاری
// نمی‌کند — حالت legacy بدون تعریف نوع، بدون هیچ تغییری کار می‌کند.
//
// دامنهٔ تحلیل (آگاهانه محدود تا false positive ندهد):
//   - فقط value directiveهایی که معنای expression یا state-path دارند بررسی
//     می‌شوند (zen-text/html/show/if/else-if/bind/memo/key/action/model/for).
//     value directiveهای ناشناخته/رشته‌ای (مثل zen-permission یا zen-track)
//     نادیده گرفته می‌شوند — معنای آن‌ها معلوم نیست.
//   - scopeهای محلی: متغیرهای zen-for (تو‌در‌تو، خوانش compiler)، پارامترهای
//     arrow function (تو‌در‌تو، سایه‌اندازی درست)، و `$event` در zen-action.
//   - `name` و `$name` یکسان‌اند (همان aliasing در binding-context).
//     `true/false/null/undefined` لفظ‌اند، نه identifier.
//   - دو خانوادهٔ خطا با کد ZEN-502 (همان «Compile-time expression error»
//     کاتالوگ — نیازی به کد جدید نیست):
//       1) unknown-identifier: نامی که نه در stateTypes است نه scope محلی.
//          پیام صریحاً می‌گوید این «unknown زمان compile» است، نه مقدار
//          `undefined` زمان اجرا (تفکیک خواسته‌شده در #111).
//       2) incompatible-type (محافظه‌کار، فقط دو حالت صوری):
//          - صدا زدن identifierای که نوع اعلان‌شده‌اش تابع نیست؛
//          - دسترسی بدون `?.` به ریشه‌ای که نوع اعلان‌شده‌اش null/undefined است.
//          shape داخلی objectها معلوم نیست، پس member-chainهای عمیق قضاوت
//          نمی‌شوند.
//   - موتور DOM-free است (اسکن متنی تک‌عبوره با جدول تگ) — برخلاف codegen که
//     به DOMParser/jsdom نیاز دارد؛ پس در edge و LSP هم کار می‌کند. ورودی
//     خراب هرگز throw نمی‌دهد (بهترین تلاش؛ یافته‌های جزئی برمی‌گردند).
//   - expressionای که parse/security آن شکست بخورد (`compile` throw کند)
//     نادیده گرفته می‌شود — مسیرهای موجود مالک آن‌اند (unplugin در build،
//     و runtime در اجرا).

import { compile, lex, sanitizeExpression, TokenType, type ASTNode, type ExpressionType } from '@zenith/expressions';

/**
 * قرارداد اختیاری نوع state برای typecheck قالب (#111).
 *
 * کلیدها نام‌های stateاند (با یا بدون `$` — نرمال‌سازی می‌شوند) و مقدارها
 * نوع اعلان‌شده‌اند (`ExpressionType` از `@zenith/expressions`).
 *
 * @public
 */
export type TemplateStateTypes = Record<string, ExpressionType>;

/** خانوادهٔ یافتهٔ typecheck قالب. @public */
export type TemplateTypeIssueKind = 'unknown-identifier' | 'incompatible-type';

/**
 * یک یافتهٔ typecheck قالب با موقعیت دقیق (۰-مبنا) در متن HTML.
 *
 * @public
 */
export interface TemplateTypeDiagnostic {
  /** همیشه `ZEN-502` (همان «Compile-time expression error» کاتالوگ). */
  code: 'ZEN-502';
  /** خانوادهٔ یافته. */
  kind: TemplateTypeIssueKind;
  /** نام identifier (همان‌طور که نوشته شده، با `$` اگر داشت). */
  name: string;
  /** مقدار کامل expression یا state-path حاوی یافته. */
  expression: string;
  /** نوع موردانتظار (فقط incompatible-type). */
  expected?: string;
  /** نوع اعلان‌شده در stateTypes (فقط incompatible-type). */
  actual?: string;
  /** نزدیک‌ترین نام شناخته‌شده (فقط unknown-identifier، وقتی فاصله ≤ ۲ باشد). */
  suggestion?: string;
  /** خط شروع (۰-مبنا). */
  line: number;
  /** ستون شروع (۰-مبنا، واحد UTF-16). */
  character: number;
  /** خط پایان (۰-مبنا). */
  endLine: number;
  /** ستون پایان (۰-مبنا). */
  endCharacter: number;
  /** پیام انسانی (بدون موقعیت — موقعیت در range است). */
  message: string;
}

// ── نزدیک‌ترین نام (همان سیاست closestDirectiveName در language-server) ──

function levenshtein(a: string, b: string): number {
  const previous: number[] = [];
  for (let j = 0; j <= b.length; j++) previous[j] = j!;
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0]!;
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const substitution = diagonal + (a[i - 1] === b[j - 1] ? 0 : 1);
      diagonal = previous[j]!;
      previous[j] = Math.min(previous[j]! + 1, previous[j - 1]! + 1, substitution);
    }
  }
  return previous[b.length]!;
}

function closestName(input: string, candidates: ReadonlySet<string>, maxDistance = 2): string | null {
  let best: string | null = null;
  let bestDistance = maxDistance + 1;
  for (const name of candidates) {
    const distance = levenshtein(input, name);
    if (distance < bestDistance || (distance === bestDistance && (best === null || name < best))) {
      best = name;
      bestDistance = distance;
    }
  }
  return bestDistance <= maxDistance ? best : null;
}

// ── نرمال‌سازی نام (`$title` و `title` یکسان‌اند، مثل binding-context) ──

function normalizeStateKey(name: string): string {
  return name.startsWith('$') ? name.slice(1) : name;
}

/** هر سه شکل یک نام محلی تا aliasing جهت‌دار خطا ندهد. */
function scopeVariants(name: string): string[] {
  const normalized = normalizeStateKey(name);
  const out = [name, normalized, `$${normalized}`];
  return [...new Set(out)];
}

// ── موقعیت خط/ستون از offset ──

function buildLineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function positionAt(lineStarts: number[], textLength: number, offset: number): { line: number; character: number } {
  const safe = Math.max(0, Math.min(offset, textLength));
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (lineStarts[mid]! <= safe) low = mid;
    else high = mid - 1;
  }
  return { line: low, character: safe - lineStarts[low]! };
}

// ── اسکنر تگ باز ──

interface ScannedAttribute {
  base: string;
  value: string | null;
  valueStart: number | null;
}

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

const FOR_DECL_RE = /^\s*\(?\s*([a-zA-Z_$][\w$]*)\s*(?:,\s*([a-zA-Z_$][\w$]*)\s*)?\)?\s+in\s+([\s\S]+)$/;
const BARE_NAME_RE = /^[a-zA-Z_$][\w$]*$/;

/** directiveهایی که value آن‌ها expression عمومی است. */
const GENERAL_EXPRESSION_DIRECTIVES = new Set([
  'zen-text',
  'zen-html',
  'zen-html-trusted',
  'zen-show',
  'zen-if',
  'zen-else-if',
  'zen-bind',
  'zen-memo',
  'zen-key',
]);

function scanOpenTag(
  text: string,
  start: number,
): { tagName: string; attrs: ScannedAttribute[]; selfClosing: boolean; end: number } | null {
  let i = start + 1;
  const nameMatch = /^[a-zA-Z][a-zA-Z0-9-]*/.exec(text.slice(i));
  if (!nameMatch) return null;
  const tagName = nameMatch[0].toLowerCase();
  i += nameMatch[0].length;
  const attrs: ScannedAttribute[] = [];
  let selfClosing = false;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i]!)) i++;
    if (i >= text.length) break;
    if (text[i] === '>') {
      i++;
      break;
    }
    if (text[i] === '/' && text[i + 1] === '>') {
      selfClosing = true;
      i += 2;
      break;
    }
    const attrMatch = /^[^\s=/>]+/.exec(text.slice(i));
    if (!attrMatch) {
      i++;
      continue;
    }
    const rawName = attrMatch[0];
    i += rawName.length;
    while (i < text.length && /\s/.test(text[i]!)) i++;
    let value: string | null = null;
    let valueStart: number | null = null;
    if (text[i] === '=') {
      i++;
      while (i < text.length && /\s/.test(text[i]!)) i++;
      const quote = text[i];
      if (quote === '"' || quote === "'") {
        const close = text.indexOf(quote, i + 1);
        if (close === -1) break;
        valueStart = i + 1;
        value = text.slice(valueStart, close);
        i = close + 1;
      } else if (i < text.length && text[i] !== '>' && !(text[i] === '/' && text[i + 1] === '>')) {
        valueStart = i;
        while (i < text.length && !/[\s>]/.test(text[i]!)) {
          if (text[i] === '/' && text[i + 1] === '>') break;
          i++;
        }
        value = text.slice(valueStart, i);
      }
    }
    if (rawName.startsWith('zen-')) {
      attrs.push({ base: rawName.split(':')[0]!, value, valueStart });
    }
  }
  return { tagName, attrs, selfClosing, end: i };
}

// ── جمع‌آوری useهای identifier از AST (به‌ترتیب متن) ──

interface IdentifierUse {
  name: string;
  /** callee مستقیم صدا زده شده (`foo(...)` — نه `obj.foo(...)`). */
  calledAsFunction: boolean;
  /** ریشهٔ زنجیرهٔ member با حداقل یک دسترسی غیراختیاری. */
  dereferenced: boolean;
  /** زیر سایهٔ پارامتر arrow است (هر دو شکل `$x`/`x`). */
  shadowed: boolean;
}

function collectUses(node: ASTNode, arrowParams: string[], out: IdentifierUse[]): void {
  const isShadowed = (name: string): boolean =>
    arrowParams.includes(name) || arrowParams.includes(normalizeStateKey(name));
  switch (node.type) {
    case 'Identifier':
      out.push({ name: node.name, calledAsFunction: false, dereferenced: false, shadowed: isShadowed(node.name) });
      break;
    case 'MemberExpression': {
      let root: ASTNode = node;
      let hasNonOptionalLink = false;
      while (root.type === 'MemberExpression') {
        if (!root.optional) hasNonOptionalLink = true;
        root = root.object;
      }
      if (root.type === 'Identifier') {
        out.push({
          name: root.name,
          calledAsFunction: false,
          dereferenced: hasNonOptionalLink,
          shadowed: isShadowed(root.name),
        });
      } else {
        collectUses(root, arrowParams, out);
      }
      let cursor: ASTNode = node;
      while (cursor.type === 'MemberExpression') {
        if (cursor.computed) collectUses(cursor.property, arrowParams, out);
        cursor = cursor.object;
      }
      break;
    }
    case 'CallExpression':
      if (node.callee.type === 'Identifier') {
        out.push({
          name: node.callee.name,
          calledAsFunction: true,
          dereferenced: false,
          shadowed: isShadowed(node.callee.name),
        });
      } else {
        collectUses(node.callee, arrowParams, out);
      }
      for (const arg of node.args) collectUses(arg, arrowParams, out);
      break;
    case 'BinaryExpression':
    case 'LogicalExpression':
    case 'NullishCoalescing':
      collectUses(node.left, arrowParams, out);
      collectUses(node.right, arrowParams, out);
      break;
    case 'UnaryExpression':
      collectUses(node.argument, arrowParams, out);
      break;
    case 'ConditionalExpression':
      collectUses(node.test, arrowParams, out);
      collectUses(node.consequent, arrowParams, out);
      collectUses(node.alternate, arrowParams, out);
      break;
    case 'ArrayExpression':
      for (const el of node.elements) collectUses(el, arrowParams, out);
      break;
    case 'ObjectExpression':
      for (const prop of node.properties) collectUses(prop.value, arrowParams, out);
      break;
    case 'ArrowFunction':
      collectUses(node.body, [...arrowParams, ...node.params.map((p) => p.name)], out);
      break;
    case 'Literal':
      break;
  }
}

const EXPRESSION_KEYWORDS = new Set(['true', 'false', 'null', 'undefined']);

/** ایندکس توکن‌های پارامتر arrow تا با useها قاطی نشوند (هر دو شکل parser). */
function arrowParamTokenIndices(source: string): Set<number> {
  let tokens;
  try {
    tokens = lex(source);
  } catch {
    return new Set();
  }
  const excluded = new Set<number>();
  for (let j = 0; j < tokens.length; j++) {
    const token = tokens[j]!;
    if (token.type !== TokenType.Punctuator || token.value !== '=>') continue;
    const prev = tokens[j - 1];
    if (!prev) continue;
    if (prev.type === TokenType.Identifier && !EXPRESSION_KEYWORDS.has(prev.value)) {
      excluded.add(j - 1);
    } else if (prev.type === TokenType.Punctuator && prev.value === ')') {
      let depth = 1;
      let k = j - 2;
      const inner: number[] = [];
      let valid = true;
      while (k >= 0 && depth > 0) {
        const t = tokens[k]!;
        if (t.type === TokenType.Punctuator && t.value === ')') depth++;
        else if (t.type === TokenType.Punctuator && t.value === '(') depth--;
        else if (depth === 1) {
          if (t.type === TokenType.Identifier && !EXPRESSION_KEYWORDS.has(t.value)) inner.push(k);
          else if (!(t.type === TokenType.Punctuator && t.value === ',')) valid = false;
        }
        k--;
      }
      if (valid && depth === 0) for (const idx of inner) excluded.add(idx);
    }
  }
  return excluded;
}

/** نگاشت هر use به span دقیق توکن؛ ناموفق → null (fallback: کل value). */
function tokenSpansForUses(source: string, uses: IdentifierUse[]): Array<{ start: number; end: number } | null> {
  let tokens;
  try {
    tokens = lex(source);
  } catch {
    return uses.map(() => null);
  }
  const excluded = arrowParamTokenIndices(source);
  const candidates = tokens
    .map((token, index) => ({ token, index }))
    .filter(
      ({ token, index }) =>
        token.type === TokenType.Identifier &&
        !EXPRESSION_KEYWORDS.has(token.value as string) &&
        !excluded.has(index),
    );
  const spans: Array<{ start: number; end: number } | null> = [];
  let cursor = 0;
  for (const use of uses) {
    let found: { start: number; end: number } | null = null;
    for (let k = cursor; k < candidates.length; k++) {
      if ((candidates[k]!.token.value as string) === use.name) {
        found = { start: candidates[k]!.token.start, end: candidates[k]!.token.end };
        cursor = k + 1;
        break;
      }
    }
    spans.push(found);
  }
  return spans;
}

// ── زمینهٔ تحلیل ──

interface AnalysisContext {
  /** نگاشت نرمال‌شدهٔ نام → نوع اعلان‌شده. */
  declared: Map<string, ExpressionType>;
  /** همهٔ نام‌های شناخته‌شده (هر دو شکل `$x`/`x` + محلی‌ها) برای پیشنهاد. */
  knownNames: Set<string>;
  /** stack متغیرهای محلی (for/item/index/event) — داخلی‌ترین آخر. */
  scopeStack: Array<Set<string>>;
  lineStarts: number[];
  textLength: number;
  diagnostics: TemplateTypeDiagnostic[];
}

function isLocal(ctx: AnalysisContext, name: string): boolean {
  for (let i = ctx.scopeStack.length - 1; i >= 0; i--) {
    if (ctx.scopeStack[i]!.has(name)) return true;
  }
  return false;
}

function pushDiagnostic(
  ctx: AnalysisContext,
  value: string,
  valueOffset: number,
  span: { start: number; end: number } | null,
  diag: Omit<TemplateTypeDiagnostic, 'line' | 'character' | 'endLine' | 'endCharacter'>,
): void {
  const start = valueOffset + (span?.start ?? 0);
  const end = valueOffset + (span?.end ?? value.length);
  const from = positionAt(ctx.lineStarts, ctx.textLength, start);
  const to = positionAt(ctx.lineStarts, ctx.textLength, end);
  ctx.diagnostics.push({ ...diag, line: from.line, character: from.character, endLine: to.line, endCharacter: to.character });
}

function suggestionFor(ctx: AnalysisContext, name: string): { suggestion?: string } {
  const candidates = new Set(ctx.knownNames);
  for (const frame of ctx.scopeStack) for (const local of frame) candidates.add(local);
  const suggestion = closestName(name, candidates);
  return suggestion === null ? {} : { suggestion };
}

function analyzeGeneralExpression(
  ctx: AnalysisContext,
  value: string,
  valueOffset: number,
  extraLocals?: ReadonlySet<string>,
): void {
  if (extraLocals && extraLocals.size > 0) ctx.scopeStack.push(new Set(extraLocals));
  try {
    let ast: ASTNode;
    try {
      ast = compile(value);
    } catch {
      return; // مسیرهای موجود مالک syntax/securityاند.
    }
    const uses: IdentifierUse[] = [];
    collectUses(ast, [], uses);
    if (uses.length === 0) return;
    // sanitize ممکن است offsetها را جابه‌جا کند (فقط ورودی‌های attack-shaped)؛
    // در آن صورت span دقیق نداریم و fallback کل value است.
    const effective = sanitizeExpression(value);
    const spans = effective === value ? tokenSpansForUses(value, uses) : uses.map(() => null);
    uses.forEach((use, idx) => {
      if (use.shadowed || isLocal(ctx, use.name)) return;
      const normalized = normalizeStateKey(use.name);
      const declared = ctx.declared.get(normalized);
      if (declared === undefined) {
        const { suggestion } = suggestionFor(ctx, use.name);
        pushDiagnostic(ctx, value, valueOffset, spans[idx] ?? null, {
          code: 'ZEN-502',
          kind: 'unknown-identifier',
          name: use.name,
          expression: value,
          ...(suggestion === null ? {} : { suggestion }),
          message:
            `Unknown identifier '${use.name}' is not declared in stateTypes (ZEN-502). ` +
            `This is a compile-time unknown, distinct from a runtime undefined value.` +
            (suggestion === null ? '' : ` Did you mean '${suggestion}'?`),
        });
        return;
      }
      if (use.calledAsFunction && declared !== 'function' && declared !== 'unknown') {
        pushDiagnostic(ctx, value, valueOffset, spans[idx] ?? null, {
          code: 'ZEN-502',
          kind: 'incompatible-type',
          name: use.name,
          expression: value,
          expected: 'function',
          actual: declared,
          message:
            `Identifier '${use.name}' is declared as '${declared}' but is called as a function (ZEN-502).`,
        });
      } else if (use.dereferenced && (declared === 'null' || declared === 'undefined')) {
        pushDiagnostic(ctx, value, valueOffset, spans[idx] ?? null, {
          code: 'ZEN-502',
          kind: 'incompatible-type',
          name: use.name,
          expression: value,
          expected: 'object',
          actual: declared,
          message:
            `Property access on '${use.name}' declared as '${declared}' (ZEN-502); ` +
            `this yields undefined at runtime. Use optional chaining ('?.') if that is intended.`,
        });
      }
    });
  } finally {
    if (extraLocals && extraLocals.size > 0) ctx.scopeStack.pop();
  }
}

function analyzeStatePath(ctx: AnalysisContext, value: string, valueOffset: number): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  const rawRoot = trimmed.split(/[.[]/, 1)[0]!;
  if (!rawRoot || !BARE_NAME_RE.test(rawRoot)) return;
  const normalized = normalizeStateKey(rawRoot);
  if (isLocal(ctx, rawRoot) || isLocal(ctx, normalized) || ctx.declared.has(normalized)) return;
  const display = trimmed.startsWith('$') ? `$${normalized}` : normalized;
  pushDiagnostic(ctx, value, valueOffset, { start: 0, end: value.length }, {
    code: 'ZEN-502',
    kind: 'unknown-identifier',
    name: display,
    expression: value,
    ...suggestionFor(ctx, display),
    message:
      `Unknown identifier '${display}' is not declared in stateTypes (ZEN-502). ` +
      `This is a compile-time unknown, distinct from a runtime undefined value.` +
      (closestName(display, ctx.knownNames) === null
        ? ''
        : ` Did you mean '${closestName(display, ctx.knownNames)}'?`),
  });
}

function analyzeActionValue(ctx: AnalysisContext, value: string, valueOffset: number): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  const eventLocals = new Set([...scopeVariants('$event')]);
  if (BARE_NAME_RE.test(trimmed)) {
    // نام تابع state (مسیر اصلی runtime) — باید تابع اعلان‌شده باشد.
    const normalized = normalizeStateKey(trimmed);
    if (isLocal(ctx, trimmed) || isLocal(ctx, normalized)) return;
    const declared = ctx.declared.get(normalized);
    const at = value.indexOf(trimmed);
    const span = { start: at, end: at + trimmed.length };
    if (declared === undefined) {
      pushDiagnostic(ctx, value, valueOffset, span, {
        code: 'ZEN-502',
        kind: 'unknown-identifier',
        name: trimmed,
        expression: value,
        ...suggestionFor(ctx, trimmed),
        message:
          `Unknown action '${trimmed}' is not declared in stateTypes (ZEN-502). ` +
          `This is a compile-time unknown, distinct from a runtime undefined value.` +
          (closestName(trimmed, ctx.knownNames) === null
            ? ''
            : ` Did you mean '${closestName(trimmed, ctx.knownNames)}'?`),
      });
    } else if (declared !== 'function' && declared !== 'unknown') {
      pushDiagnostic(ctx, value, valueOffset, span, {
        code: 'ZEN-502',
        kind: 'incompatible-type',
        name: trimmed,
        expression: value,
        expected: 'function',
        actual: declared,
        message: `Action '${trimmed}' is declared as '${declared}', not a function (ZEN-502).`,
      });
    }
    return;
  }
  analyzeGeneralExpression(ctx, value, valueOffset, eventLocals);
}

function analyzeAttributeValue(ctx: AnalysisContext, attr: ScannedAttribute): void {
  const value = attr.value!;
  const valueOffset = attr.valueStart!;
  if (!value.trim()) return;
  if (GENERAL_EXPRESSION_DIRECTIVES.has(attr.base)) {
    analyzeGeneralExpression(ctx, value, valueOffset);
    return;
  }
  if (attr.base === 'zen-for') return; // در analyzeElementAttributes رسیدگی شد.
  if (attr.base === 'zen-model') {
    analyzeStatePath(ctx, value, valueOffset);
    return;
  }
  if (attr.base === 'zen-action') {
    analyzeActionValue(ctx, value, valueOffset);
    return;
  }
  // بقیه (zen-ref/slot/permission/role/track/ناشناخته‌ها): معنای value
  // expression نیست یا معلوم نیست — نادیده (بدون false positive).
}

/**
 * تحلیل type-safe یک template کامل با state schema اختیاری (#111).
 *
 * موتور مشترک compiler (`compileTemplate` با `stateTypes`) و language-server
 * (`computeDiagnostics` با همان گزینه). بدون `stateTypes` خروجی همیشه `[]`
 * است — حالت legacy دست‌نخورده می‌ماند. هرگز throw نمی‌کند.
 *
 * @param html متن کامل template.
 * @param stateTypes قرارداد اختیاری نوع state (غایب = legacy، بدون تحلیل).
 * @public
 */
export function analyzeTemplateTypes(html: string, stateTypes?: TemplateStateTypes): TemplateTypeDiagnostic[] {
  const diagnostics: TemplateTypeDiagnostic[] = [];
  if (stateTypes === undefined) return diagnostics;
  try {
    const declared = new Map<string, ExpressionType>();
    for (const [key, type] of Object.entries(stateTypes)) declared.set(normalizeStateKey(key), type);
    const knownNames = new Set<string>();
    for (const key of declared.keys()) {
      knownNames.add(key);
      knownNames.add(`$${key}`);
    }
    const ctx: AnalysisContext = {
      declared,
      knownNames,
      scopeStack: [],
      lineStarts: buildLineStarts(html),
      textLength: html.length,
      diagnostics,
    };

    // جدول تگ باز (tag → عمق scope قبل از تحلیل attributeهایش).
    const openStack: Array<{ tagName: string; scopeDepth: number }> = [];
    let i = 0;
    while (i < html.length) {
      const lt = html.indexOf('<', i);
      if (lt === -1) break;
      i = lt;
      if (html.startsWith('<!--', i)) {
        const close = html.indexOf('-->', i + 4);
        i = close === -1 ? html.length : close + 3;
        continue;
      }
      if (html[i + 1] === '/') {
        const m = /^<\/\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(i));
        if (m) {
          const name = m[1]!.toLowerCase();
          while (openStack.length > 0 && openStack[openStack.length - 1]!.tagName !== name) {
            const popped = openStack.pop()!;
            ctx.scopeStack.length = popped.scopeDepth;
          }
          if (openStack.length > 0) {
            const popped = openStack.pop()!;
            ctx.scopeStack.length = popped.scopeDepth;
          }
          const gt = html.indexOf('>', i);
          i = gt === -1 ? html.length : gt + 1;
          continue;
        }
        i++;
        continue;
      }
      if (html[i + 1] === '!' || html[i + 1] === '?') {
        const gt = html.indexOf('>', i);
        i = gt === -1 ? html.length : gt + 1;
        continue;
      }
      const tag = scanOpenTag(html, i);
      if (!tag) {
        i++;
        continue;
      }
      i = tag.end;
      const baseDepth = ctx.scopeStack.length;
      try {
        analyzeElementAttributes(ctx, tag.attrs);
      } catch {
        // بهترین تلاش — یک عنصر خراب، بقیهٔ سند را خراب نمی‌کند.
        ctx.scopeStack.length = baseDepth;
      }
      if (tag.tagName === 'script' || tag.tagName === 'style') {
        ctx.scopeStack.length = baseDepth;
        const closeRe = new RegExp(`</\\s*${tag.tagName}\\s*>`, 'gi');
        closeRe.lastIndex = i;
        const m = closeRe.exec(html);
        i = m ? m.index + m[0].length : html.length;
        continue;
      }
      if (!VOID_ELEMENTS.has(tag.tagName) && !tag.selfClosing) {
        openStack.push({ tagName: tag.tagName, scopeDepth: baseDepth });
      } else {
        // عنصر بی‌فرزند: scope همین تگ است.
        ctx.scopeStack.length = baseDepth;
      }
    }
  } catch {
    // قرارداد «هرگز throw» — یافته‌های جزئی برمی‌گردند.
  }
  diagnostics.sort(
    (a, b) => a.line - b.line || a.character - b.character || a.message.localeCompare(b.message),
  );
  return diagnostics;
}

function analyzeElementAttributes(ctx: AnalysisContext, attrs: ScannedAttribute[]): void {
  const forAttr = attrs.find((a) => a.base === 'zen-for');
  if (forAttr && forAttr.value !== null && forAttr.valueStart !== null) {
    const decl = FOR_DECL_RE.exec(forAttr.value);
    if (!decl) return; // اعلان خراب — مسیرهای موجود مالک‌اند.
    const itemName = decl[1]!;
    const indexName = decl[2] ?? 'index';
    const listExpr = decl[3]!.trim();
    if (listExpr) {
      // lastIndexOf: وقتی binder و list هم‌متن‌اند (`item in item`)، دمِ value
      // همان list است (regex با `in…$` لنگر شده).
      const listOffset = forAttr.valueStart + forAttr.value.lastIndexOf(listExpr);
      analyzeGeneralExpression(ctx, listExpr, listOffset);
    }
    // scope حلقه برای همین تگ و فرزندان می‌ماند (بسته‌شدن تگ آن را برمی‌گرداند).
    const frame = new Set<string>([...scopeVariants(itemName), ...scopeVariants(indexName)]);
    ctx.scopeStack.push(frame);
    for (const attr of attrs) {
      if (attr.base === 'zen-for' || attr.value === null || attr.valueStart === null) continue;
      analyzeAttributeValue(ctx, attr);
    }
    return;
  }
  for (const attr of attrs) {
    if (attr.value === null || attr.valueStart === null) continue;
    analyzeAttributeValue(ctx, attr);
  }
}
