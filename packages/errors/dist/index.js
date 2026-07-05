// packages/errors/src/index.ts
//
// @zenith/errors — کتابخانه‌ی پیام‌های خطای Zenith
//
// این پکیج یک سیستم ساختاریافته برای خطاها فراهم می‌کند:
//   - کدهای خطای منظم (ZEN-001 تا ZEN-999)
//   - پیام‌های فارسی قابل‌فهم برای کاربر
//   - پیشنهادها (suggestions) برای رفع خطا
//   - جزئیات (details) برای دیباگ
//   - Stack trace برای ردیابی منشأ خطا
//
// ── ساختار کدها ──
//
// ZEN-001 تا ZEN-099: خطاهای Expression / Validator
// ZEN-100 تا ZEN-199: خطاهای Runtime / Directive
// ZEN-200 تا ZEN-299: خطاهای Resource
// ZEN-300 تا ZEN-399: خطاهای SSR
// ZEN-400 تا ZEN-499: خطاهای Security
// ZEN-500 تا ZEN-599: خطاهای Compiler
// ZEN-600 تا ZEN-699: خطاهای Router
// ZEN-700 تا ZEN-799: خطاهای Form / Validation
// ZEN-800 تا ZEN-899: خطاهای Component
// ZEN-900 تا ZEN-999: خطاهای عمومی / Internal
// ─────────────────────────────────────────────────────────────
// ZenithError Class
// ─────────────────────────────────────────────────────────────
/**
 * کلاس پایه برای تمام خطاهای Zenith.
 *
 * @property code      کد خطا (مثلاً "ZEN-002")
 * @property category  دسته‌ی خطا (مثلاً "Expression")
 * @property message   پیام اصلی خطا
 * @property suggestion پیشنهاد برای رفع خطا (اختیاری)
 * @property details   جزئیات اضافی برای دیباگ (اختیاری)
 * @property context   context در زمان خطا (اختیاری)
 */
export class ZenithError extends Error {
    code;
    category;
    suggestion;
    details;
    context;
    isDevMode;
    constructor(opts) {
        super(opts.message, { cause: opts.cause });
        this.name = 'ZenithError';
        this.code = opts.code;
        this.category = opts.category;
        this.suggestion = opts.suggestion;
        this.details = opts.details;
        this.context = opts.context;
        this.isDevMode = typeof globalThis !== 'undefined' &&
            globalThis.__ZENITH_DEV__ !== false;
        // Maintain proper stack trace (V8 only).
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, ZenithError);
        }
    }
    /**
     * تبدیل خطا به یک فرمت کاربرپسند برای نمایش در console.
     */
    toUserString() {
        let out = `❌ [${this.code}] ${this.category}: ${this.message}`;
        if (this.suggestion) {
            out += `\n\n💡 پیشنهاد: ${this.suggestion}`;
        }
        if (this.isDevMode && this.details) {
            out += `\n\n🔍 جزئیات: ${JSON.stringify(this.details, null, 2)}`;
        }
        return out;
    }
    /**
     * تبدیل خطا به JSON برای API responses.
     */
    toJSON() {
        return {
            error: true,
            code: this.code,
            category: this.category,
            message: this.message,
            suggestion: this.suggestion,
            details: this.isDevMode ? this.details : undefined,
        };
    }
}
// ─────────────────────────────────────────────────────────────
// Error Codes
// ─────────────────────────────────────────────────────────────
export const ErrorCode = {
    // Expression / Validator (ZEN-001 to ZEN-099)
    EXPRESSION_VARIABLE_NOT_DEFINED: 'ZEN-001',
    EXPRESSION_SECURITY_FORBIDDEN_PROPERTY: 'ZEN-002',
    EXPRESSION_SECURITY_FORBIDDEN_IDENTIFIER: 'ZEN-003',
    EXPRESSION_SYNTAX_ERROR: 'ZEN-004',
    EXPRESSION_NOT_A_FUNCTION: 'ZEN-005',
    EXPRESSION_UNKNOWN_OPERATOR: 'ZEN-006',
    EXPRESSION_UNKNOWN_NODE_TYPE: 'ZEN-007',
    // Runtime / Directive (ZEN-100 to ZEN-199)
    RUNTIME_ZEN_FOR_NO_ZEN_KEY: 'ZEN-101',
    RUNTIME_ZEN_FOR_INVALID_SYNTAX: 'ZEN-102',
    RUNTIME_ZEN_FOR_NO_PARENT: 'ZEN-103',
    RUNTIME_ZEN_IF_NO_PARENT: 'ZEN-104',
    RUNTIME_DIRECTIVE_EXPRESSION_FAILED: 'ZEN-105',
    RUNTIME_COMPONENT_NOT_FOUND: 'ZEN-106',
    RUNTIME_DISPOSE_FAILED: 'ZEN-107',
    // Resource (ZEN-200 to ZEN-299)
    RESOURCE_DESTROYED: 'ZEN-201',
    RESOURCE_HTTP_ERROR: 'ZEN-202',
    RESOURCE_URL_EVALUATION_FAILED: 'ZEN-203',
    RESOURCE_SIGNAL_NOT_FOUND: 'ZEN-204',
    RESOURCE_MUTATION_FAILED: 'ZEN-205',
    // SSR (ZEN-300 to ZEN-399)
    SSR_JSDOM_REQUIRED: 'ZEN-301',
    SSR_NO_ROOT_ELEMENT: 'ZEN-302',
    SSR_ASYNC_LOCAL_STORAGE_UNAVAILABLE: 'ZEN-303',
    SSR_HYDRATION_MISMATCH: 'ZEN-304',
    // Security (ZEN-400 to ZEN-499)
    SECURITY_XSS_BLOCKED: 'ZEN-401',
    SECURITY_SANITIZATION_FAILED: 'ZEN-402',
    // Compiler (ZEN-500 to ZEN-599)
    COMPILE_UNKNOWN_DIRECTIVE: 'ZEN-501',
    COMPILE_EXPRESSION_ERROR: 'ZEN-502',
    // Router (ZEN-600 to ZEN-699)
    ROUTER_ROUTE_NOT_FOUND: 'ZEN-601',
    ROUTER_LAZY_LOAD_FAILED: 'ZEN-602',
    // Form (ZEN-700 to ZEN-799)
    FORM_VALIDATION_FAILED: 'ZEN-701',
    FORM_SCHEMA_INVALID: 'ZEN-702',
    // Component (ZEN-800 to ZEN-899)
    COMPONENT_SLOT_NOT_FOUND: 'ZEN-801',
    COMPONENT_PROP_REQUIRED: 'ZEN-802',
    // Internal (ZEN-900 to ZEN-999)
    INTERNAL_UNKNOWN: 'ZEN-901',
};
// ─────────────────────────────────────────────────────────────
// Error Factory Functions
// ─────────────────────────────────────────────────────────────
/**
 * FEATURE (v1.0.0): خطای «متغیر تعریف‌نشده» با پیشنهاد typo correction.
 *
 * پیام اصلی: `Variable '$x' is not defined in context.`
 * پیام بهبودیافته: لیست متغیرهای available + پیشنهاد typo correction.
 */
export function variableNotDefinedError(varName, availableVars = []) {
    // Levenshtein-like typo detection.
    const suggestion = findClosestMatch(varName, availableVars);
    const details = {};
    if (availableVars.length > 0) {
        details.availableVariables = availableVars;
    }
    if (suggestion) {
        details.suggestedVariable = suggestion;
    }
    return new ZenithError({
        code: ErrorCode.EXPRESSION_VARIABLE_NOT_DEFINED,
        category: 'Expression',
        message: `متغیر «${varName}» در context تعریف نشده است.`,
        suggestion: suggestion
            ? `آیا منظور شما «${suggestion}» بود؟ (اصلاح املا)`
            : availableVars.length > 0
                ? `متغیرهای موجود: ${availableVars.join('، ')}`
                : 'متغیری در context موجود نیست. مطمئن شوید state به‌درستی پاس داده شده.',
        details,
        context: { varName, availableVars },
    });
}
/**
 * FEATURE (v1.0.0): خطای «zen-key وجود ندارد» با مثال.
 */
export function zenForNoZenKeyError(expr) {
    return new ZenithError({
        code: ErrorCode.RUNTIME_ZEN_FOR_NO_ZEN_KEY,
        category: 'Runtime',
        message: `دایرکتیو zen-for روی «${expr}» attribute های zen-key ندارد.`,
        suggestion: `برای keyed diffing صحیح، zen-key اضافه کنید:\n` +
            `  <li zen-for="item in $items" zen-key="item.id">\n` +
            `بدون zen-key، reordering باعث destroy و rebuild تمام DOM node ها می‌شود (کندتر).`,
        details: { expr },
        context: { expr },
    });
}
/**
 * FEATURE (v1.0.0): خطای «Resource destroyed» با راهنمای ردیابی.
 */
export function resourceDestroyedError(resourceName, operation, destroyStack) {
    return new ZenithError({
        code: ErrorCode.RESOURCE_DESTROYED,
        category: 'Resource',
        message: `Resource «${resourceName}» قبلاً destroy() شده است و عملیات «${operation}» مجاز نیست.`,
        suggestion: `این Resource با destroy() غیرفعال شده. برای ردیابی:\n` +
            `  ۱. در کد جستجو کنید: ${resourceName}.destroy()\n` +
            `  ۲. معمولاً در cleanup hooks (onUnmounted, useEffect cleanup) صدا زده می‌شود.\n` +
            `  ۳. برای revive کردن: ${resourceName}.reset()`,
        details: {
            resourceName,
            operation,
            destroyStack: destroyStack || 'Stack trace هنگام destroy() در دسترس نیست.',
        },
        context: { resourceName, operation },
    });
}
/**
 * FEATURE (v1.0.0): خطای SSR با تشخیص محیط.
 */
export function ssrEnvironmentError(issue, details) {
    const isBrowser = typeof window !== 'undefined';
    const isNode = typeof process !== 'undefined' && process.versions?.node;
    let env = 'unknown';
    if (isBrowser)
        env = 'browser';
    else if (isNode)
        env = `Node.js ${process.versions.node}`;
    switch (issue) {
        case 'jsdom-missing':
            return new ZenithError({
                code: ErrorCode.SSR_JSDOM_REQUIRED,
                category: 'SSR',
                message: 'برای SSR به jsdom نیاز است اما نصب نیست.',
                suggestion: `jsdom را نصب کنید:\n` +
                    `  npm install jsdom\n` +
                    `  یا\n` +
                    `  bun add jsdom\n\n` +
                    `محیط فعلی: ${env}\n` +
                    (isBrowser
                        ? '⚠️ SSR در browser قابل اجرا نیست. این کد فقط در سرور (Node.js) کار می‌کند.'
                        : ''),
                details: { environment: env, ...details },
                context: { issue, env },
            });
        case 'als-unavailable':
            return new ZenithError({
                code: ErrorCode.SSR_ASYNC_LOCAL_STORAGE_UNAVAILABLE,
                category: 'SSR',
                message: 'AsyncLocalStorage در دسترس نیست.',
                suggestion: `AsyncLocalStorage یک API داخلی Node.js است (node:async_hooks).\n` +
                    `محیط فعلی: ${env}\n` +
                    (isBrowser
                        ? '⚠️ در browser، SSR پشتیبانی نمی‌شود.\n' +
                            'اگر در browser هستید، از Zen.start مستقیم استفاده کنید (نه renderToString).'
                        : 'Node.js 16+ لازم است. ورژن Node را بررسی کنید.'),
                details: { environment: env, ...details },
                context: { issue, env },
            });
        case 'no-root':
            return new ZenithError({
                code: ErrorCode.SSR_NO_ROOT_ELEMENT,
                category: 'SSR',
                message: 'عنصر root در HTML یافت نشد.',
                suggestion: `مطمئن شوید HTML ورودی یک body با محتوا دارد:\n` +
                    `  <body><div id="app">...</div></body>\n` +
                    `نه فقط: <body></body>`,
                details: { environment: env, ...details },
                context: { issue, env },
            });
        default:
            return new ZenithError({
                code: ErrorCode.INTERNAL_UNKNOWN,
                category: 'Internal',
                message: `خطای SSR ناشناخته: ${issue}`,
                details: { environment: env, ...details },
            });
    }
}
/**
 * FEATURE (v1.0.0): خطای امنیتی برای دسترسی ممنوعه.
 */
export function securityError(code, property, isRuntime = false) {
    const messages = {
        'ZEN-002': {
            msg: `دسترسی به پراپرتی «${property}» ممنوع است (prototype pollution).`,
            cat: 'Security',
        },
        'ZEN-003': {
            msg: `دسترسی به identifier «${property}» ممنوع است (global خطرناک).`,
            cat: 'Security',
        },
        'ZEN-401': {
            msg: `محتوای XSS مسدود شد: «${property}».`,
            cat: 'Security',
        },
    };
    const info = messages[code] ?? messages['ZEN-002'];
    return new ZenithError({
        code,
        category: info.cat,
        message: info.msg,
        suggestion: isRuntime
            ? `این دسترسی در runtime توسط guard مسدود شد. ` +
                `اگر فکر می‌کنید این اشتباه است، expression را بررسی کنید.`
            : `این دسترسی در compile time توسط validator مسدود شد. ` +
                `از دسترسی به constructor، __proto__، prototype خودداری کنید.`,
        details: { property, isRuntime },
        context: { property },
    });
}
/**
 * FEATURE (v1.0.0): خطای HTTP برای Resource.
 */
export function resourceHttpError(url, status, statusText) {
    const suggestion = status === 404
        ? `URL «${url}» یافت نشد (404). مسیر endpoint را بررسی کنید.`
        : status === 401 || status === 403
            ? `دسترسی غیرمجاز (${status}). کلید API یا credentials را بررسی کنید.`
            : status >= 500
                ? `خطای سرور (${status}). سرور در دسترس نیست یا خطای داخلی دارد.`
                : status === 0
                    ? `درخواست شبکه ناموفق. سرور در حال اجرا است؟ CORS درست تنظیم شده؟`
                    : `خطای HTTP ${status}. StatusText: ${statusText}`;
    return new ZenithError({
        code: ErrorCode.RESOURCE_HTTP_ERROR,
        category: 'Resource',
        message: `خطای HTTP ${status}: ${statusText}`,
        suggestion,
        details: { url, status, statusText },
        context: { url, status },
    });
}
/**
 * FEATURE (v1.0.0): خطای syntax برای expression.
 */
export function expressionSyntaxError(expr, position, unexpectedToken) {
    return new ZenithError({
        code: ErrorCode.EXPRESSION_SYNTAX_ERROR,
        category: 'Expression',
        message: `خطای syntax در position ${position}: token غیرمنتظره «${unexpectedToken}».`,
        suggestion: `Expression: «${expr}»\n` +
            `مثال‌های معتبر:\n` +
            `  $user.name\n` +
            `  $count + 1\n` +
            `  $items.length > 0 ? \"بله\" : \"خیر\"\n` +
            `  $user.age > 18 && $user.active`,
        details: { expr, position, unexpectedToken },
        context: { expr, position },
    });
}
/**
 * FEATURE (v1.0.0): خطای zen-for invalid syntax.
 */
export function zenForInvalidSyntaxError(expr) {
    return new ZenithError({
        code: ErrorCode.RUNTIME_ZEN_FOR_INVALID_SYNTAX,
        category: 'Runtime',
        message: `سینتکس zen-for نامعتبر: «${expr}»`,
        suggestion: `سینتکس صحیح:\n` +
            `  zen-for="item in $items"\n` +
            `  zen-for="(item, index) in $items"\n` +
            `  zen-for="item in $items.filter(x => x.active)"`,
        details: { expr },
        context: { expr },
    });
}
// ─────────────────────────────────────────────────────────────
// Typo Detection Helper (Levenshtein distance)
// ─────────────────────────────────────────────────────────────
/**
 * یافتن نزدیک‌ترین تطابق با استفاده از Levenshtein distance.
 *
 * @param input نام متغیر ورودی (مثلاً "$usr")
 * @param candidates لیست متغیرهای موجود (مثلاً ["$user", "$data"])
 * @returns نزدیک‌ترین تطابق یا null
 */
export function findClosestMatch(input, candidates) {
    if (candidates.length === 0)
        return null;
    // Normalize: remove $ prefix for comparison.
    const normalized = input.replace(/^\$/, '');
    const normalizedCandidates = candidates.map((c) => ({
        original: c,
        normalized: c.replace(/^\$/, ''),
    }));
    let bestMatch = null;
    let bestDistance = Infinity;
    for (const { original, normalized: candidate } of normalizedCandidates) {
        const dist = levenshtein(normalized, candidate);
        // Only suggest if distance is reasonable (within 50% of the longer string).
        const threshold = Math.max(normalized.length, candidate.length) / 2;
        if (dist < bestDistance && dist <= threshold) {
            bestDistance = dist;
            bestMatch = original;
        }
    }
    return bestMatch;
}
/**
 * محاسبه Levenshtein distance بین دو رشته.
 */
function levenshtein(a, b) {
    if (a === b)
        return 0;
    if (a.length === 0)
        return b.length;
    if (b.length === 0)
        return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j] + 1);
            }
        }
    }
    return matrix[b.length][a.length];
}
// ─────────────────────────────────────────────────────────────
// Utility: isZenithError type guard
// ─────────────────────────────────────────────────────────────
export function isZenithError(err) {
    return err instanceof ZenithError ||
        (typeof err === 'object' && err !== null && 'code' in err && 'category' in err);
}
/**
 * تبدیل هر خطایی به ZenithError (اگر قبلاً نیست).
 */
export function toZenithError(err) {
    if (isZenithError(err))
        return err;
    if (err instanceof Error) {
        return new ZenithError({
            code: ErrorCode.INTERNAL_UNKNOWN,
            category: 'Internal',
            message: err.message,
            cause: err,
        });
    }
    return new ZenithError({
        code: ErrorCode.INTERNAL_UNKNOWN,
        category: 'Internal',
        message: String(err),
    });
}
//# sourceMappingURL=index.js.map