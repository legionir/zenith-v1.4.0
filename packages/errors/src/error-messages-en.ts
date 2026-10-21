// packages/errors/src/error-messages-en.ts
//
// نقشهٔ انگلیسی پیام‌های کاتالوگ — استخراج مکانیکی از core.ts بدون تغییر
// رفتار (#40، code-first: نوشته‌شده، اجرا نشده).


/**
 * نمونهٔ انگلیسی message/suggestion هر کد رزورشده (#102).
 * fa همچنان اولیه و کانونیک است؛ کلیدها باید با RESERVED_ERROR_CODES یکسان باشند
 * (تست یکتایی در wave6-batch5 این را قفل می‌کند).
 */
/** @public */
export const ERROR_MESSAGES_EN: Readonly<Record<string, { message: string; suggestion: string }>> =
  {
    'ZEN-1001': {
      message: 'Invalid option: type or value at the given path does not satisfy the schema.',
      suggestion: 'Fix the value to the type expected by the schema; the error path is in details.',
    },
    'ZEN-1002': {
      message: 'Unknown key in options.',
      suggestion: 'Check the key spelling; allowed keys are listed in details.',
    },
    'ZEN-1003': {
      message: 'Malformed JSON in attribute.',
      suggestion: 'The attribute value must be valid JSON (no trailing commas, no single quotes).',
    },
    'ZEN-1004': {
      message: 'Value out of allowed range.',
      suggestion: 'Keep the value between the min/max declared in details.',
    },
    'ZEN-1090': {
      message: 'Invalid argument to option validation function.',
      suggestion:
        'See the schema docs for the function signature; the second argument must be a valid schema.',
    },
    'ZEN-1091': {
      message: 'Logger sink is broken (error while writing a log record).',
      suggestion: 'Replace or remove the sink; the error is reported once and never loops.',
    },
    'ZEN-1101': {
      message: 'Storage unavailable (e.g. browser private mode).',
      suggestion: 'Fall back to the memory adapter or present a graceful notice to the user.',
    },
    'ZEN-1102': {
      message: 'Storage quota exceeded.',
      suggestion: 'Prune old keys or switch to the IndexedDB adapter.',
    },
    'ZEN-1103': {
      message: 'Data migration failed.',
      suggestion: 'Check the migrate function; old data may need pruning or re-versioning.',
    },
    'ZEN-1104': {
      message: 'Stored data is corrupt/unparseable.',
      suggestion: 'The corrupt key is removed; rebuild the data source.',
    },
    'ZEN-1201': {
      message: 'Invalid ttl.',
      suggestion: 'ttl must be an integer >= 0 (ms); 0 means no expiry.',
    },
    'ZEN-1202': {
      message: 'Cache loader failed.',
      suggestion: 'See cause for the original error; check retry/fallback.',
    },
    'ZEN-1301': {
      message: 'Date outside the supported Jalali calendar range.',
      suggestion: 'Allowed range is 1201..1500 SH (DEC-020: throw instead of warn).',
    },
    'ZEN-1302': {
      message: 'Invalid date format.',
      suggestion: 'Allowed tokens: YYYY YY MM M DD D MMM MMMM; remove unknown combinations.',
    },
    'ZEN-1303': {
      message: 'Invalid date (does not exist).',
      suggestion: 'Check day/month (e.g. Esfand 30 does not have 31).',
    },
    'ZEN-1311': {
      message: 'Message key not found.',
      suggestion: 'Add the key to the bundle or change the missing policy (throw/warn/empty).',
    },
    'ZEN-1312': {
      message: 'Invalid ICU format.',
      suggestion: 'Validate the {plural, select, ...} structure against the i18n docs.',
    },
    'ZEN-1313': {
      message: 'Unsupported locale.',
      suggestion: 'Register the locale in the fallback list or load its bundle.',
    },
    'ZEN-1314': {
      message: 'Loading messages failed.',
      suggestion: 'Check the loader path and network; the original error is in cause.',
    },
    'ZEN-1401': {
      message: 'No focusable element found for focus-trap.',
      suggestion: 'Place at least one focusable element inside the container or disable the trap.',
    },
    'ZEN-1402': {
      message: 'Nested trap with unsupported order.',
      suggestion: 'Use the internal trap stack; do not nest traps manually.',
    },
    'ZEN-1403': {
      message: 'aria-* attribute incompatible with the element role.',
      suggestion: 'Match role/aria with WAI-ARIA (ARIA in HTML).',
    },
    'ZEN-1501': {
      message: 'Tag not allowed.',
      suggestion: 'See the §head allowlist; body tags are forbidden in head.',
    },
    'ZEN-1502': {
      message: 'Invalid JSON-LD.',
      suggestion: 'Serialize the object with JSON.stringify and check schema.org.',
    },
    'ZEN-1503': {
      message: 'Tag count exceeded maxTags.',
      suggestion: 'Merge tags or knowingly raise maxTags.',
    },
    'ZEN-1601': {
      message: 'Trigger element not found.',
      suggestion: 'Fix the trigger selector or verify it is rendered.',
    },
    'ZEN-1602': {
      message: 'zen-tab without a matching zen-tabpanel.',
      suggestion: 'Give every tab a panel with a matching aria-controls.',
    },
    'ZEN-1603': {
      message: 'Value outside the options.',
      suggestion: 'value must be one of the options (or the allowed placeholder).',
    },
    'ZEN-1604': {
      message: 'Portal has no target.',
      suggestion: 'The portal target must point to an element present in the DOM.',
    },
    'ZEN-1701': {
      message: 'Connection failed.',
      suggestion: 'Check URL/network; automatic backoff is retrying.',
    },
    'ZEN-1702': {
      message: 'Invalid message (parse failed).',
      suggestion: 'Match the message format (default: JSON) with the service parser.',
    },
    'ZEN-1703': {
      message: 'Insecure protocol: ws:// on an https page.',
      suggestion: 'Use wss:// (mixed-content).',
    },
    'ZEN-1704': {
      message: 'Send queue full.',
      suggestion: 'Reduce send rate or raise maxQueueSize; dropped messages are in details.',
    },
    'ZEN-1705': {
      message: 'Heartbeat timeout.',
      suggestion: 'Check the service heartbeatInterval and the connection; auto reconnect starts.',
    },
    'ZEN-1801': {
      message: 'SSR render stopped by timeout.',
      suggestion: 'Increase renderTimeoutMs or move slow path data into suspense.',
    },
    'ZEN-1802': {
      message: 'Invalid template: no output marker.',
      suggestion: 'Put <!--zen-outlet--> (or the configured marker) inside the template.',
    },
    'ZEN-1803': {
      message: 'AsyncLocalStorage unavailable in this runtime.',
      suggestion: 'Enable the explicit context (domImpl/ALS-free path #92) (DEC-022).',
    },
    'ZEN-1811': {
      message: 'Unsupported runtime.',
      suggestion: 'Choose Node >=18.19, Cloudflare Workers or Deno (DEC-027).',
    },
    'ZEN-1812': {
      message: 'DOM implementation not installed.',
      suggestion: 'Install linkedom or happy-dom as a dependency (domImpl).',
    },
    'ZEN-1821': {
      message: 'Route failed to render during SSG.',
      suggestion: 'Verify the path exists in routes/paths and prerender passed.',
    },
    'ZEN-1822': {
      message: 'Data unavailable at build time.',
      suggestion: 'Make the data source available during build or mark the route CSR/ISR.',
    },
    'ZEN-1901': {
      message: 'Analytics provider failed (error not swallowed; reported separately).',
      suggestion:
        'Check or temporarily disable the provider; event data and the original error are omitted for privacy.',
    },
    'ZEN-1902': {
      message: 'User consent required.',
      suggestion: 'Enable the consent manager before tracking (GDPR).',
    },
    'ZEN-2001': {
      message: 'Invalid theme token.',
      suggestion: 'Ensure the token exists in the theme definition and the value is CSS-valid.',
    },
    'ZEN-2002': {
      message: 'Theme storage unavailable.',
      suggestion: 'Use the memory storage or an alternative for theme.',
    },
    'ZEN-2101': {
      message: 'state mismatch (possible CSRF).',
      suggestion:
        'Continue the flow from the same browser/tab; state is single-use (RFC 6749 §10.12).',
    },
    'ZEN-2102': {
      message: 'Invalid id_token.',
      suggestion: 'Check issuer/audience and the (JWKS) signature.',
    },
    'ZEN-2103': {
      message: 'Discovery failed.',
      suggestion: 'Check the /.well-known/openid-configuration address of the service.',
    },
    'ZEN-2104': {
      message: 'Refresh expired.',
      suggestion: 'Sign the user in again (re-auth); make refresh token renewal policy-driven.',
    },
    'ZEN-2105': {
      message: 'Callback without code.',
      suggestion: 'Set response_type=code in authorize; parse error from the query.',
    },
    'ZEN-2201': {
      message: 'Flag not defined (dev only).',
      suggestion: 'Register the flag in the registry; in prod the default value is used.',
    },
    'ZEN-2202': {
      message: 'Failed to load the flag source.',
      suggestion: 'Check the source (remote/file) and network; the cached fallback is in use.',
    },
    'ZEN-2301': {
      message: 'onMount/onUnmount/onUpdate outside directive/component scope.',
      suggestion:
        'These hooks are only allowed while running a directive function or component setup.',
    },
    'ZEN-2302': {
      message: 'Conflicting structural directives on one element.',
      suggestion: 'Keep only one of zen-if/zen-for/zen-switch/and similar per element.',
    },
    'ZEN-2303': {
      message: 'zen-for without zen-key.',
      suggestion: 'Give each item a unique stable zen-key (same as ZEN-101; for the new core API).',
    },
    'ZEN-2310': {
      message: 'Hydration mismatch.',
      suggestion: 'Server and client must render identical markup; check data and markers.',
    },
    'ZEN-2320': {
      message: 'Package versions not in lockstep (assertCompatible).',
      suggestion: 'All @zenith/* packages must share one version; run npm ls @zenith.',
    },
    'ZEN-2401': {
      message: 'Incompatible hook version.',
      suggestion: 'Keep devtools and runtime on the same version (lockstep, DEC-026).',
    },
    'ZEN-2402': {
      message: 'Invalid snapshot.',
      suggestion: 'Follow the §devtools-core snapshot structure; send the required fields.',
    },
    'ZEN-2501': {
      message: 'Invalid project name.',
      suggestion: 'Only [a-z0-9-_.]; no "..", absolute path or separator (create-zenith §3.9).',
    },
    'ZEN-2510': {
      message: 'Metadata (zenith.meta.json) failed to load.',
      suggestion: 'Was the build run with meta:true and is the file path correct?',
    },
    'ZEN-2520': {
      message: 'Plugin not supported on this bundler.',
      suggestion: 'unplugin supports only rollup/vite/webpack/rspack (SPEC §4.4).',
    },
    'ZEN-2521': {
      message: 'Incompatible HMR.',
      suggestion: 'Match bundler/plugin versions or disable HMR.',
    },
    'ZEN-2530': {
      message: 'Request without handler (mock).',
      suggestion:
        'Register the matching handler or set onUnhandledRequest to bypass; path/method in details.',
    },
    'ZEN-2531': {
      message: 'Handler responded twice (mock).',
      suggestion:
        'Each resolver must call respond() only once (do not combine passthrough with respond).',
    },
    'ZEN-9001': {
      message: 'Unable to read file (check).',
      suggestion: 'Check file permissions/path (replaces legacy Z001).',
    },
    'ZEN-9010': {
      message: 'Removed compileAndRender is used (unsafe).',
      suggestion:
        'Use zen-text or zen-html with safe pre-compiled expressions (replaces legacy Z100).',
    },
    'ZEN-9011': {
      message: 'Use of eval() or new Function() in <script>.',
      suggestion:
        'The eval pattern is forbidden in Zenith for security/XSS (replaces legacy Z101).',
    },
    'ZEN-9020': {
      message: 'Deprecated directive.',
      suggestion: 'Use the official replacement per DEPRECATED_DIRECTIVES (replaces legacy Z200).',
    },
    'ZEN-9021': {
      message: 'Unknown directive.',
      suggestion:
        'Check the zen-* spelling against the valid directive list (replaces legacy Z201).',
    },
    'ZEN-9030': {
      message: 'zen-for without zen-key.',
      suggestion: 'Add a unique zen-key per item (DOM thrashing/state loss; replaces legacy Z300).',
    },
    'ZEN-9031': {
      message: 'zen-text with an empty expression.',
      suggestion: 'Provide a valid expression or remove the directive (replaces legacy Z301).',
    },
    'ZEN-9032': {
      message: 'zen-if with an empty expression.',
      suggestion: 'Provide a valid conditional expression (replaces legacy Z302).',
    },
    'ZEN-9040': {
      message: 'zen-html with a probably injectable variable.',
      suggestion:
        'Sanitize input with sanitizeHTML or keep the default allowlist (replaces legacy Z400).',
    },
    'ZEN-9050': {
      message: 'Directory traversal pattern in path.',
      suggestion: 'Constrain paths to the project root (replaces legacy Z500).',
    },
    'ZEN-9060': {
      message: 'Potential secret in code.',
      suggestion: 'Move keys/tokens to env (replaces legacy Z600).',
    },
    'ZEN-9061': {
      message: 'Weak referrer policy in head.',
      suggestion:
        'Set referrerpolicy to no-referrer or strict-origin-when-cross-origin (replaces legacy Z601).',
    },
    'ZEN-9070': {
      message: 'fetch with an insecure scheme (http).',
      suggestion: 'Use https or review the URL pattern (replaces legacy Z700).',
    },
    'ZEN-9080': {
      message: 'Event attribute (on*) in template.',
      suggestion: 'Use zen-click/zen-action (safe event delegation) (replaces legacy Z800).',
    },
    'ZEN-9081': {
      message: 'iframe without sandbox.',
      suggestion: 'Add a restrictive sandbox to the iframe (replaces legacy Z810).',
    },
    'ZEN-9082': {
      message: 'External link without rel=noopener.',
      suggestion: 'Add rel="noopener noreferrer" to target=_blank (replaces legacy Z820).',
    },
  };
