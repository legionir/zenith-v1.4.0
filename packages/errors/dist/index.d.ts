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
export declare class ZenithError extends Error {
    readonly code: string;
    readonly category: ErrorCategory;
    readonly suggestion?: string;
    readonly details?: Record<string, unknown>;
    readonly context?: Record<string, unknown>;
    readonly isDevMode: boolean;
    constructor(opts: {
        code: string;
        category: ErrorCategory;
        message: string;
        suggestion?: string;
        details?: Record<string, unknown>;
        context?: Record<string, unknown>;
        cause?: unknown;
    });
    /**
     * تبدیل خطا به یک فرمت کاربرپسند برای نمایش در console.
     */
    toUserString(): string;
    /**
     * تبدیل خطا به JSON برای API responses.
     */
    toJSON(): Record<string, unknown>;
}
export type ErrorCategory = 'Expression' | 'Runtime' | 'Resource' | 'SSR' | 'Security' | 'Compiler' | 'Router' | 'Form' | 'Component' | 'Internal';
export declare const ErrorCode: {
    readonly EXPRESSION_VARIABLE_NOT_DEFINED: "ZEN-001";
    readonly EXPRESSION_SECURITY_FORBIDDEN_PROPERTY: "ZEN-002";
    readonly EXPRESSION_SECURITY_FORBIDDEN_IDENTIFIER: "ZEN-003";
    readonly EXPRESSION_SYNTAX_ERROR: "ZEN-004";
    readonly EXPRESSION_NOT_A_FUNCTION: "ZEN-005";
    readonly EXPRESSION_UNKNOWN_OPERATOR: "ZEN-006";
    readonly EXPRESSION_UNKNOWN_NODE_TYPE: "ZEN-007";
    readonly RUNTIME_ZEN_FOR_NO_ZEN_KEY: "ZEN-101";
    readonly RUNTIME_ZEN_FOR_INVALID_SYNTAX: "ZEN-102";
    readonly RUNTIME_ZEN_FOR_NO_PARENT: "ZEN-103";
    readonly RUNTIME_ZEN_IF_NO_PARENT: "ZEN-104";
    readonly RUNTIME_DIRECTIVE_EXPRESSION_FAILED: "ZEN-105";
    readonly RUNTIME_COMPONENT_NOT_FOUND: "ZEN-106";
    readonly RUNTIME_DISPOSE_FAILED: "ZEN-107";
    readonly RESOURCE_DESTROYED: "ZEN-201";
    readonly RESOURCE_HTTP_ERROR: "ZEN-202";
    readonly RESOURCE_URL_EVALUATION_FAILED: "ZEN-203";
    readonly RESOURCE_SIGNAL_NOT_FOUND: "ZEN-204";
    readonly RESOURCE_MUTATION_FAILED: "ZEN-205";
    readonly SSR_JSDOM_REQUIRED: "ZEN-301";
    readonly SSR_NO_ROOT_ELEMENT: "ZEN-302";
    readonly SSR_ASYNC_LOCAL_STORAGE_UNAVAILABLE: "ZEN-303";
    readonly SSR_HYDRATION_MISMATCH: "ZEN-304";
    readonly SECURITY_XSS_BLOCKED: "ZEN-401";
    readonly SECURITY_SANITIZATION_FAILED: "ZEN-402";
    readonly COMPILE_UNKNOWN_DIRECTIVE: "ZEN-501";
    readonly COMPILE_EXPRESSION_ERROR: "ZEN-502";
    readonly ROUTER_ROUTE_NOT_FOUND: "ZEN-601";
    readonly ROUTER_LAZY_LOAD_FAILED: "ZEN-602";
    readonly FORM_VALIDATION_FAILED: "ZEN-701";
    readonly FORM_SCHEMA_INVALID: "ZEN-702";
    readonly COMPONENT_SLOT_NOT_FOUND: "ZEN-801";
    readonly COMPONENT_PROP_REQUIRED: "ZEN-802";
    readonly INTERNAL_UNKNOWN: "ZEN-901";
};
export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];
/**
 * FEATURE (v1.0.0): خطای «متغیر تعریف‌نشده» با پیشنهاد typo correction.
 *
 * پیام اصلی: `Variable '$x' is not defined in context.`
 * پیام بهبودیافته: لیست متغیرهای available + پیشنهاد typo correction.
 */
export declare function variableNotDefinedError(varName: string, availableVars?: string[]): ZenithError;
/**
 * FEATURE (v1.0.0): خطای «zen-key وجود ندارد» با مثال.
 */
export declare function zenForNoZenKeyError(expr: string): ZenithError;
/**
 * FEATURE (v1.0.0): خطای «Resource destroyed» با راهنمای ردیابی.
 */
export declare function resourceDestroyedError(resourceName: string, operation: string, destroyStack?: string): ZenithError;
/**
 * FEATURE (v1.0.0): خطای SSR با تشخیص محیط.
 */
export declare function ssrEnvironmentError(issue: 'jsdom-missing' | 'als-unavailable' | 'no-root', details?: Record<string, unknown>): ZenithError;
/**
 * FEATURE (v1.0.0): خطای امنیتی برای دسترسی ممنوعه.
 */
export declare function securityError(code: 'ZEN-002' | 'ZEN-003' | 'ZEN-401', property: string, isRuntime?: boolean): ZenithError;
/**
 * FEATURE (v1.0.0): خطای HTTP برای Resource.
 */
export declare function resourceHttpError(url: string, status: number, statusText: string): ZenithError;
/**
 * FEATURE (v1.0.0): خطای syntax برای expression.
 */
export declare function expressionSyntaxError(expr: string, position: number, unexpectedToken: string): ZenithError;
/**
 * FEATURE (v1.0.0): خطای zen-for invalid syntax.
 */
export declare function zenForInvalidSyntaxError(expr: string): ZenithError;
/**
 * یافتن نزدیک‌ترین تطابق با استفاده از Levenshtein distance.
 *
 * @param input نام متغیر ورودی (مثلاً "$usr")
 * @param candidates لیست متغیرهای موجود (مثلاً ["$user", "$data"])
 * @returns نزدیک‌ترین تطابق یا null
 */
export declare function findClosestMatch(input: string, candidates: string[]): string | null;
export declare function isZenithError(err: unknown): err is ZenithError;
/**
 * تبدیل هر خطایی به ZenithError (اگر قبلاً نیست).
 */
export declare function toZenithError(err: unknown): ZenithError;
//# sourceMappingURL=index.d.ts.map