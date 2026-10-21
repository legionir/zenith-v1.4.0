/** @public */
export function sanitizeCSS(css: string): string {
  if (!css || typeof css !== 'string') return '';
  return (
    css
      // Remove IE expression() XSS
      .replace(/expression\s*\(/gi, '')
      // Remove javascript: URLs
      .replace(/javascript\s*:/gi, '')
      // Remove @import which can load external styles
      .replace(/@import\s+/gi, '')
      // Remove behavior: (IE-specific)
      .replace(/behavior\s*:/gi, '')
      // Remove -moz-binding (Firefox XBL)
      .replace(/-moz-binding\s*:/gi, '')
      // Remove url() with dangerous protocols
      .replace(/url\s*\(\s*(javascript|data|vbscript)\s*:/gi, 'url(')
  );
}
