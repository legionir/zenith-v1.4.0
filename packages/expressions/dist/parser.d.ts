/**
 * انواع نودهای درخت AST.
 *
 * طراحی Discriminated Union: فیلد type به عنوان tag عمل می‌کند
 * و TypeScript می‌تواند در switch روی آن Type Narrowing دقیق انجام دهد.
 */
export type ASTNode = {
    type: 'Literal';
    value: any;
} | {
    type: 'Identifier';
    name: string;
} | {
    type: 'MemberExpression';
    object: ASTNode;
    property: ASTNode;
    computed: boolean;
} | {
    type: 'CallExpression';
    callee: ASTNode;
    args: ASTNode[];
} | {
    type: 'BinaryExpression';
    operator: string;
    left: ASTNode;
    right: ASTNode;
} | {
    type: 'LogicalExpression';
    operator: string;
    left: ASTNode;
    right: ASTNode;
} | {
    type: 'UnaryExpression';
    operator: string;
    argument: ASTNode;
} | {
    type: 'ConditionalExpression';
    test: ASTNode;
    consequent: ASTNode;
    alternate: ASTNode;
} | {
    type: 'ObjectExpression';
    properties: Array<{
        key: string;
        value: ASTNode;
    }>;
} | {
    type: 'ArrayExpression';
    elements: ASTNode[];
} | {
    type: 'NullishCoalescing';
    left: ASTNode;
    right: ASTNode;
} | {
    type: 'ArrowFunction';
    params: Array<{
        name: string;
    }>;
    body: ASTNode;
};
/**
 * کلاس Parser.
 *
 * نکته: این کلاس Single-use است؛ یعنی برای هر Expression یک instance
 * جدید ساخته می‌شود. این انتخاب آگاهانه است چون:
 *   1) Parser را Reentrant می‌کند (می‌تواند در حین parse، parse دیگری کند).
 *   2) با Caching در cache.ts هم‌خوانی دارد (هر expression یک instance).
 */
export declare class Parser {
    private tokens;
    private pos;
    constructor(input: string);
    private peek;
    private current;
    private consume;
    /**
     * مصرف Token فعلی به شرطی که value آن برابر مقدار مورد انتظار باشد.
     * در غیر این صورت، خطای syntax پرتاب می‌شود.
     */
    private expect;
    /**
     * بررسی اینکه Token فعلی یک Punctuator با value مشخص است.
     *
     * این helper بسیار مهم است: اگر فقط value را چک کنیم، یک String token
     * با مقدار "!". می‌تواند به اشتباه به عنوان عملگر ! تفسیر شود.
     *
     * @example
     *   // غلط:
     *   if (this.current().value === '!') { ... }
     *   // درست:
     *   if (this.match('!')) { ... }
     */
    private match;
    /**
     * بررسی اینکه Token فعلی یکی از چند Punctuator باشد.
     */
    private matchAny;
    /**
     * Parse کردن Expression و برگرداندن ریشه‌ی AST.
     *
     * شروع از پایین‌ترین اولویت (Conditional) تا بالاترین (Primary).
     */
    parse(): ASTNode;
    /**
     * عملگر سه‌تایی: test ? consequent : alternate
     *
     * نکته: این تابع به صورت بازگشتی خودش را صدا می‌زند تا right-associativity
     * حفظ شود. یعنی `a ? b : c ? d : e` به صورت `a ? b : (c ? d : e)` parse می‌شود.
     */
    private parseConditional;
    /**
     * عملگر || (Logical OR) و ?? (Nullish Coalescing) — left-associative.
     *
     * در جاوااسکریپت، `??` و `||` بدون پرانتز نمی‌توانند ترکیب شوند (Syntax Error).
     * برای سادگی، در این فریم‌ورک هر دو در همین سطح اولویت parse می‌شوند و
     * به ترتیب چپ به راست اعمال می‌شوند. این رفتار برای template expressions کافی است.
     */
    private parseLogicalOr;
    /**
     * عملگر && (Logical AND) — left-associative.
     */
    private parseLogicalAnd;
    /**
     * عملگرهای Equality: == === != !==
     */
    private parseEquality;
    /**
     * عملگرهای Relational: < > <= >=
     */
    private parseRelational;
    /**
     * عملگرهای جمع و تفریق: + -
     */
    private parseAdditive;
    /**
     * عملگرهای ضرب و تقسیم: * / %
     */
    private parseMultiplicative;
    /**
     * عملگرهای یکانی: ! (NOT) و - (منفی).
     *
     * نکته‌ی مهم: باید حتماً type === Punctuator باشد.
     * در غیر این صورت، String token با مقدار "!" به اشتباه
     * به عنوان عملگر ! تفسیر می‌شود.
     *
     * به صورت بازگشتی خودش را صدا می‌زند تا چندگانه بودن پشتیبانی شود:
     * مثال: `--5` یا `!!flag`.
     */
    private parseUnary;
    /**
     * دسترسی به پراپرتی و فراخوانی تابع: a.b، a[b]، a(b).
     *
     * این تابع در یک حلقه تا زمانی که کاراکتر بعدی `.`، `[` یا `(` باشد
     * ادامه می‌دهد و node را به ترتیب wrap می‌کند:
     *
     *   a.b.c    →  MemberExpression(MemberExpression(a, b), c)
     *   a[b]     →  MemberExpression(a, b, computed: true)
     *   a(b)(c)  →  CallExpression(CallExpression(a, [b]), [c])
     *   a.b(c)   →  CallExpression(MemberExpression(a, b), [c])
     */
    private parseMemberOrCall;
    /**
     * مقادیر پایه: Number، String، Identifier، Parenthesized Expression، یا Object Literal.
     */
    private parsePrimary;
    /**
     * پارس کردن یک Object Literal: `{ key1: expr1, key2: expr2, ... }`.
     *
     * نکته: key می‌تواند هم Identifier باشد (`active: ...`) و هم String (`'text-red': ...`).
     * در هر دو حالت، در AST به صورت string ذخیره می‌شود.
     *
     * مثال:
     *   { active: $isActive, 'text-red': $hasError }
     *   →
     *   ObjectExpression {
     *     properties: [
     *       { key: 'active', value: Identifier($isActive) },
     *       { key: 'text-red', value: Identifier($hasError) },
     *     ]
     *   }
     */
    private parseObjectExpression;
    /**
     * پارس کردن یک property از Object Literal: `key: value`.
     *
     * key می‌تواند:
     *   - Identifier (مثل `active`)
     *   - String Literal (مثل `'text-red'`)
     */
    private parseObjectProperty;
}
//# sourceMappingURL=parser.d.ts.map