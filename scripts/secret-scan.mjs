#!/usr/bin/env node
/**
 * #65 — Secret scanner for CI and pre-push checks (`scripts/secret-scan.mjs`).
 * Detects high-confidence credential patterns (GitHub PATs, AWS keys, private keys,
 * Slack tokens, Stripe live keys) in tracked repository files.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SECRET_RULES = [
  {
    id: 'github-pat',
    description: 'GitHub Personal Access Token',
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,255}\b/,
  },
  {
    id: 'github-fine-grained-pat',
    description: 'GitHub Fine-Grained Personal Access Token',
    regex: /\bgithub_pat_[A-Za-z0-9_]{80,255}\b/,
  },
  {
    id: 'aws-access-key-id',
    description: 'AWS Access Key ID',
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    id: 'private-key-pem',
    description: 'PEM Private Key',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  {
    id: 'slack-token',
    description: 'Slack Token',
    regex: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24,34}\b/,
  },
  {
    id: 'stripe-live-secret',
    description: 'Stripe Live Secret Key',
    regex: /\bsk_live_[0-9a-zA-Z]{24,99}\b/,
  },
];

const IGNORED_PATH_PATTERNS = [
  /^node_modules\//,
  /^dist\//,
  /\.test\.(?:ts|js|mjs|cjs)$/,
  /^tests\//,
  /^docs\//,
  /^package-lock\.json$/,
];

export function scanContentForSecrets(content, filePath = '<memory>') {
  const findings = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('gitleaks:allow')) continue;
    for (const rule of SECRET_RULES) {
      if (rule.regex.test(line)) {
        findings.push({
          file: filePath,
          line: i + 1,
          ruleId: rule.id,
          description: rule.description,
        });
      }
    }
  }
  return findings;
}

export function scanRepositoryForSecrets(rootDir = process.cwd()) {
  const output = execFileSync('git', ['ls-files'], {
    cwd: rootDir,
    encoding: 'utf8',
  });
  const files = output
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const allFindings = [];
  for (const relPath of files) {
    if (IGNORED_PATH_PATTERNS.some((p) => p.test(relPath))) continue;
    const absPath = join(rootDir, relPath);
    if (!existsSync(absPath)) continue;
    try {
      const content = readFileSync(absPath, 'utf8');
      const findings = scanContentForSecrets(content, relPath);
      allFindings.push(...findings);
    } catch {
      // Skip binary/unreadable files
    }
  }
  return { scannedFiles: files.length, findings: allFindings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { scannedFiles, findings } = scanRepositoryForSecrets();
  if (findings.length > 0) {
    console.error('❌ Secret scan failed (#65): potential credentials detected:');
    for (const f of findings) {
      console.error(`  - ${f.file}:${f.line} [${f.ruleId}] ${f.description}`);
    }
    process.exit(1);
  }
  console.log(`✅ secret-scan (#65): ${scannedFiles} tracked files scanned, 0 secrets found.`);
}
