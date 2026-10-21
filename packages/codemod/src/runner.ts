// packages/codemod/src/runner.ts — اجرای transformها روی متن و دیسک (#167)
//
// دو سطح: `transformText` خالص (تست‌پذیر؛ idempotency) و `runCodemods` دیسکی
// (اسکن دایرکتوری، `--write`، گزارش JSON-serializable برای `--report json`).
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { applyEdits, cleanupRemovedSpecifiers } from './edits';
import { CodemodError } from './errors';
import { parseSource, syntaxManualItem } from './parse';
import { transformById, TRANSFORMS } from './registry';
import type { Transform } from './transform';
import type {
  CodemodReport,
  FileResult,
  ManualItem,
  RunCodemodsOptions,
  TextResult,
  TransformId,
} from './types';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.cache',
]);

/** @public حل شناسه‌ها به transform (ناشناس ⇒ CodemodError). */
export function resolveTransforms(ids?: readonly TransformId[]): readonly Transform[] {
  if (!ids) return TRANSFORMS;
  return ids.map((id) => {
    const transform = transformById(id);
    if (!transform) throw new CodemodError(`Unknown transform: ${id}.`);
    return transform;
  });
}

/**
 * اعمال transformها روی یک متن (خالص). سینتکس نامعتبر ⇒ متن بدون تغییر +
 * مورد manual (مهلک نیست).
 *
 * @public
 */
export function transformText(
  path: string,
  text: string,
  ids?: readonly TransformId[],
): TextResult {
  const transforms = resolveTransforms(ids);
  const parsed = parseSource(text, path);
  if (!parsed) {
    return {
      text,
      applied: [],
      manual: transforms.map((transform) => syntaxManualItem(path, transform.id)),
    };
  }
  const { source, checker } = parsed;
  const applied = new Set<TransformId>();
  const manual: ManualItem[] = [];
  let current = text;
  // هر transform روی AST متنِ به‌روزشده اجرا می‌شود (ترتیب جدول spec).
  for (const transform of transforms) {
    const reparsed = parseSource(current, path);
    if (!reparsed) {
      manual.push(syntaxManualItem(path, transform.id));
      continue;
    }
    const output = transform.run({
      file: path,
      text: current,
      source: reparsed.source,
      checker: reparsed.checker,
    });
    manual.push(...output.manual);
    if (output.edits.length === 0) continue;
    const { text: next, dropped } = applyEdits(current, output.edits);
    if (dropped > 0) {
      manual.push({
        file: path,
        line: 1,
        transform: transform.id,
        message: `${dropped} overlapping edit(s) were skipped — review the file manually.`,
      });
    }
    if (next !== current) {
      applied.add(transform.id);
      current = cleanupRemovedSpecifiers(next);
    }
  }
  manual.sort((a, b) => a.line - b.line);
  return { text: current, applied: [...applied], manual };
}

/** گردآوری فایل‌های منبع زیر یک ریشه (بدون ورود به EXCLUDED_DIRS). */
function collectFiles(root: string, seeds?: readonly string[]): string[] {
  if (seeds && seeds.length > 0) {
    const out: string[] = [];
    for (const seed of seeds) {
      const full = join(root, seed);
      if (!existsSync(full) || !statSync(full).isFile()) {
        throw new CodemodError(`File not found: ${seed}.`, seed);
      }
      out.push(full);
    }
    return out;
  }
  const out: string[] = [];
  const queue = [root];
  let scanned = 0;
  for (let i = 0; i < queue.length; i++) {
    for (const entry of readdirSync(queue[i]!, { withFileTypes: true })) {
      if (++scanned > 20000) {
        throw new CodemodError('Scan exceeds the 20,000-entry safety limit. Pass explicit files.');
      }
      if (entry.name.startsWith('.zenith-upgrade-')) continue;
      const target = join(queue[i]!, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) queue.push(target);
        continue;
      }
      if (!entry.isFile()) continue;
      const dot = entry.name.lastIndexOf('.');
      const ext = dot >= 0 ? entry.name.slice(dot) : '';
      if (!SOURCE_EXTENSIONS.has(ext) || /\.d\.[cm]?ts$/.test(entry.name)) continue;
      if (statSync(target).size > 1024 * 1024) continue;
      out.push(target);
    }
  }
  return out.sort();
}

/**
 * اجرای دیسکی: خواندن، transform، و (با `write: true`) نوشتن.
 * پیش‌فرض dry-run است (بدون هیچ نوشتن).
 *
 * @public
 */
export function runCodemods(options: RunCodemodsOptions = {}): CodemodReport {
  const root = options.root ?? '.';
  const transforms = resolveTransforms(options.transforms);
  const ids = transforms.map((transform) => transform.id);
  const files = collectFiles(root, options.files);
  const results: FileResult[] = [];
  const manual: ManualItem[] = [];
  let changedCount = 0;

  for (const full of files) {
    const rel = relative(root, full).split('\\').join('/');
    const before = readFileSync(full, 'utf8');
    const result = transformText(rel, before, ids);
    const changed = result.text !== before;
    if (changed) changedCount++;
    if (changed && options.write === true) {
      writeFileSync(full, result.text, 'utf8');
    }
    results.push({ path: rel, changed, applied: result.applied, manual: result.manual });
    manual.push(...result.manual);
  }
  manual.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
  return { files: results, manual, changedCount, checkFailed: changedCount > 0 };
}
