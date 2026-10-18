import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
declare const __ZENITH_PKG_VERSION__: string | undefined;

/** Resolve the installed CLI version without reading a consumer package as CLI metadata. @public */
export function getCliVersion(): string {
  if (typeof __ZENITH_PKG_VERSION__ === 'string' && __ZENITH_PKG_VERSION__.length > 0) {
    return __ZENITH_PKG_VERSION__;
  }
  const candidates: string[] = [];
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(path.join(here, '..', 'package.json'));
  } catch {}
  candidates.push(path.join(process.cwd(), 'packages', 'cli', 'package.json'));
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
          name?: string;
          version?: string;
        };
        if (parsed.version && (!parsed.name || parsed.name === '@zenith/cli')) {
          return parsed.version;
        }
      }
    } catch {}
  }
  return '1.4.0';
}
