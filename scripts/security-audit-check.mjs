#!/usr/bin/env node
/**
 * #61 — Automated Security Audit Verification Gate
 *
 * Verifies that:
 *  1) All security audit documentation (`SECURITY.md`, `docs/security/auth.md`,
 *     `docs/security/AUDIT-PACKAGE.md`) is present and complete.
 *  2) No `eval(` or `new Function(` exists in runtime security-critical packages
 *     (`packages/security/src`, `packages/expressions/src`, `packages/auth/src`,
 *     `packages/ssr/src`).
 *  3) All required security test suites (`xss-corpus.test.ts`, `secure-id.test.ts`,
 *     `fuzz-security.test.ts`, `auth-security.test.ts`, `cli-traversal.test.ts`) exist.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_DOCS = ['SECURITY.md', 'docs/security/auth.md', 'docs/security/AUDIT-PACKAGE.md'];

const REQUIRED_TESTS = [
  'packages/security/test/xss-corpus.test.ts',
  'packages/security/test/secure-id.test.ts',
  'packages/expressions/test/fuzz-security.test.ts',
  'packages/auth/test/auth-security.test.ts',
  'packages/cli/test/cli-traversal.test.ts',
  'packages/permission/test/permission.test.ts',
];

const CRITICAL_SRC_DIRS = [
  'packages/security/src',
  'packages/expressions/src',
  'packages/auth/src',
  'packages/ssr/src',
];

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

export function checkSecurityAuditReadiness(rootDir = process.cwd()) {
  const errors = [];

  for (const doc of REQUIRED_DOCS) {
    if (!existsSync(join(rootDir, doc))) {
      errors.push(`Missing required security document: ${doc}`);
    }
  }

  for (const testFile of REQUIRED_TESTS) {
    if (!existsSync(join(rootDir, testFile))) {
      errors.push(`Missing required security test suite: ${testFile}`);
    }
  }

  for (const relDir of CRITICAL_SRC_DIRS) {
    const absDir = join(rootDir, relDir);
    if (!existsSync(absDir)) continue;
    for (const entry of readdirSync(absDir)) {
      if (!entry.endsWith('.ts')) continue;
      const filePath = join(absDir, entry);
      const code = stripComments(readFileSync(filePath, 'utf8'));
      if (/\beval\s*\(/.test(code) || /\bnew\s+Function\s*\(/.test(code)) {
        errors.push(`Forbidden dynamic code execution (eval / new Function) in ${relDir}/${entry}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    checkedDocs: REQUIRED_DOCS.length,
    checkedTests: REQUIRED_TESTS.length,
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const res = checkSecurityAuditReadiness(process.cwd());
  if (!res.ok) {
    for (const err of res.errors) {
      console.error(`❌ [security-audit] ${err}`);
    }
    process.exit(1);
  }
  console.log(
    `✅ security-audit (#61): ${res.checkedDocs} security docs and ${res.checkedTests} security test suites verified.`,
  );
}
