// @zenith/templates — canonical home of project-name validation (#158).
//
// Moved verbatim from `packages/cli/src/validate-project-name.ts` (AUDIT
// CLI-03, #7): prevents directory traversal in scaffolding. The CLI module is
// now a facade re-exporting this file, so both entry points share the rules.

import path from 'node:path';

/** @public Maximum allowed project-name length (common filesystems allow 255 bytes). */
export const MAX_PROJECT_NAME_LENGTH = 100;

/** Windows-reserved device names (case-insensitive; with extension still reserved). */
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Allowed pattern: ASCII letters/digits plus `-`, `_`, `.`; must start with a
 * letter or digit so `..`, hidden dot-names (`.hidden`, `..x`) are rejected.
 * `/`, `\` and any other character (spaces, `:`, lookalike separators) are banned.
 */
const VALID_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/**
 * Validate a scaffold project name.
 *
 * @public
 * @param name Raw user input (before any normalize).
 * @param cwd Reference directory; the resolved path must stay inside it.
 * @returns `null` when valid, otherwise a clear actionable error message.
 */
export function validateProjectName(name: string, cwd: string = process.cwd()): string | null {
  const trimmed = name.normalize('NFC');

  if (trimmed.length === 0) {
    return 'Project name must not be empty.';
  }
  if (trimmed.length > MAX_PROJECT_NAME_LENGTH) {
    return `Project name must be at most ${MAX_PROJECT_NAME_LENGTH} characters (got ${trimmed.length}).`;
  }
  // Absolute POSIX/Windows paths — even before the pattern, because path.join
  // with an absolute segment discards cwd and escapes it.
  if (/^([/\\]|[a-zA-Z]:[\\/])/.test(trimmed)) {
    return 'Project name must not be an absolute path.';
  }
  // Path separators in any form (including Windows backslash and Unicode separators).
  if (/[/\\\u2024\u2025\u2215\uff0f\uff3c]/.test(trimmed)) {
    return 'Project name must not contain path separators.';
  }
  if (!VALID_NAME.test(trimmed)) {
    return 'Project name may only contain letters, digits, "-", "_" and ".", and must start with a letter or digit.';
  }
  if (WINDOWS_RESERVED.test(trimmed)) {
    return `"${trimmed}" is a reserved Windows device name.`;
  }
  // Final latch: the resolved path must stay inside cwd (defense-in-depth).
  const resolved = path.resolve(cwd, trimmed);
  const root = path.resolve(cwd);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return 'Resolved project path escapes the current directory.';
  }
  return null;
}
