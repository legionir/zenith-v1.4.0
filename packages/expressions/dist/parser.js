// packages/expressions/src/parser.ts
//
// Parser: مرحله‌ی دوم از کامپایل Expression.
// دنباله‌ی Tokenهای خروجی Lexer را به یک درخت نحوی (AST) تبدیل می‌کند.
//
// الگوریتم: Recursive Descent Parser
//   برای هر سطح اولویت عملگر، یک تابع parse داریم که به صورت بازگشتی
//   سطوح بالاتر را صدا می‌زند. به این ترتیب اولویت عملگرها به طور
//   طبیعی رعایت می‌شود.
//
// سلسله مراتب اولویت (از پایین به بالا):
//   Conditional  (a ? b : c)            ← پایین‌ترین اولویت، right-associative
//   LogicalOr    (||)
//   LogicalAnd   (&&)
//   Equality     (== === != !==)
//   Relational   (< > <= >=)
//   Additive     (+ -)
//   Multiplicative (* / %)
//   Unary        (! -)
//   MemberOrCall (. [ ] ())            ← بالاترین اولویت، left-associative
//   Primary      (Literals, Identifiers, ( ))
//
// نکته‌ی امنیتی مهم:
//   در تمام چک‌های عملگر، علاوه بر value باید type === Punctuator هم باشد.
//   در غیر این صورت، یک String با مقدار "!" (مثلاً "!" در "+ flag + "!"")
//   به اشتباه به عنوان عملگر یکانی ! تفسیر می‌شود.
import { lex, TokenType } from './lexer.js';
/**
 * کلاس Parser.
 *
 * نکته: این کلاس Single-use است؛ یعنی برای هر Expression یک instance
 * جدید ساخته می‌شود. این انتخاب آگاهانه است چون:
 *   1) Parser را Reentrant می‌کند (می‌تواند در حین parse، parse دیگری کند).
 *   2) با Caching در cache.ts هم‌خوانی دارد (هر expression یک instance).
 */
export class Parser {
    tokens = [];
    pos = 0;
    // SEC FIX (v1.2.6): SEC-A10 — depth counter + hard cap to prevent
    // stack-overflow / catastrophic backtracking on attacker-controlled deeply
    // nested input (e.g. `(((((((...)))))))`). 200 is well above any realistic
    // Zenith template expression while still leaving headroom.
    depth = 0;
    static MAX_DEPTH = 200;
    constructor(input) {
        this.tokens = lex(input);
    }
    // ── کمک‌کننده‌ها ──────────────────────────────────────
    peek(offset = 1) {
        return this.tokens[this.pos + offset];
    }
    current() {
        return this.tokens[this.pos];
    }
    consume() {
        return this.tokens[this.pos++];
    }
    /**
     * مصرف Token فعلی به شرطی که value آن برابر مقدار مورد انتظار باشد.
     * در غیر این صورت، خطای syntax پرتاب می‌شود.
     */
    expect(value) {
        const token = this.current();
        if (token.value !== value) {
            throw new Error(`Syntax Error at position ${token.start}: expected '${value}' but got '${token.value}'`);
        }
        return this.consume();
    }
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
    match(value) {
        const token = this.current();
        return token.type === TokenType.Punctuator && token.value === value;
    }
    /**
     * بررسی اینکه Token فعلی یکی از چند Punctuator باشد.
     */
    matchAny(values) {
        const token = this.current();
        if (token.type !== TokenType.Punctuator)
            return false;
        return values.includes(token.value);
    }
    // ── نقطه‌ی شروع ────────────────────────────────────────
    /**
     * Parse کردن Expression و برگرداندن ریشه‌ی AST.
     *
     * شروع از پایین‌ترین اولویت (Conditional) تا بالاترین (Primary).
     */
    parse() {
        return this.parseConditional();
    }
    // ── توابع Parse (به ترتیب اولویت) ─────────────────────
    /**
     * عملگر سه‌تایی: test ? consequent : alternate
     *
     * نکته: این تابع به صورت بازگشتی خودش را صدا می‌زند تا right-associativity
     * حفظ شود. یعنی `a ? b : c ? d : e` به صورت `a ? b : (c ? d : e)` parse می‌شود.
     */
    parseConditional() {
        const test = this.parseLogicalOr();
        if (this.match('?')) {
            this.consume();
            const consequent = this.parseConditional(); // بازگشتی برای right-associativity
            this.expect(':');
            const alternate = this.parseConditional(); // بازگشتی برای right-associativity
            return { type: 'ConditionalExpression', test, consequent, alternate };
        }
        return test;
    }
    /**
     * عملگر || (Logical OR) و ?? (Nullish Coalescing) — left-associative.
     *
     * در جاوااسکریپت، `??` و `||` بدون پرانتز نمی‌توانند ترکیب شوند (Syntax Error).
     * برای سادگی، در این فریم‌ورک هر دو در همین سطح اولویت parse می‌شوند و
     * به ترتیب چپ به راست اعمال می‌شوند. این رفتار برای template expressions کافی است.
     */
    parseLogicalOr() {
        let left = this.parseLogicalAnd();
        while (this.match('||') || this.match('??')) {
            const op = this.consume().value;
            const right = this.parseLogicalAnd();
            if (op === '??') {
                left = { type: 'NullishCoalescing', left, right };
            }
            else {
                left = { type: 'LogicalExpression', operator: op, left, right };
            }
        }
        return left;
    }
    /**
     * عملگر && (Logical AND) — left-associative.
     */
    parseLogicalAnd() {
        let left = this.parseEquality();
        while (this.match('&&')) {
            const op = this.consume().value;
            const right = this.parseEquality();
            left = { type: 'LogicalExpression', operator: op, left, right };
        }
        return left;
    }
    /**
     * عملگرهای Equality: == === != !==
     */
    parseEquality() {
        let left = this.parseRelational();
        while (this.matchAny(['==', '===', '!=', '!=='])) {
            const op = this.consume().value;
            const right = this.parseRelational();
            left = { type: 'BinaryExpression', operator: op, left, right };
        }
        return left;
    }
    /**
     * عملگرهای Relational: < > <= >=
     */
    parseRelational() {
        let left = this.parseAdditive();
        while (this.matchAny(['<', '>', '<=', '>='])) {
            const op = this.consume().value;
            const right = this.parseAdditive();
            left = { type: 'BinaryExpression', operator: op, left, right };
        }
        return left;
    }
    /**
     * عملگرهای جمع و تفریق: + -
     */
    parseAdditive() {
        let left = this.parseMultiplicative();
        while (this.matchAny(['+', '-'])) {
            const op = this.consume().value;
            const right = this.parseMultiplicative();
            left = { type: 'BinaryExpression', operator: op, left, right };
        }
        return left;
    }
    /**
     * عملگرهای ضرب و تقسیم: * / %
     */
    parseMultiplicative() {
        let left = this.parseUnary();
        while (this.matchAny(['*', '/', '%'])) {
            const op = this.consume().value;
            const right = this.parseUnary();
            left = { type: 'BinaryExpression', operator: op, left, right };
        }
        return left;
    }
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
    parseUnary() {
        if (this.matchAny(['!', '-'])) {
            const op = this.consume().value;
            const argument = this.parseUnary();
            return { type: 'UnaryExpression', operator: op, argument };
        }
        return this.parseMemberOrCall();
    }
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
    parseMemberOrCall() {
        let node = this.parsePrimary();
        while (true) {
            if (this.match('.') || this.match('?.')) {
                // ── a.b  یا  a?.b (optional chaining) ──
                // BUG-17 FIX (v1.2.2): در حالت `?.`، optional: true ست می‌شود تا
                // evaluator بتواند short-circuit کند.
                const isOptional = this.match('?.');
                this.consume();
                const property = this.parsePrimary();
                if (property.type !== 'Identifier') {
                    throw new Error(`Syntax Error at position ${this.current().start}: ` +
                        `expected identifier after '.' but got '${this.current().value}'`);
                }
                node = { type: 'MemberExpression', object: node, property, computed: false, optional: isOptional };
            }
            else if (this.match('[')) {
                // ── a[b] ──
                this.consume();
                const property = this.parseConditional();
                this.expect(']');
                node = { type: 'MemberExpression', object: node, property, computed: true };
            }
            else if (this.match('(')) {
                // ── a(b, c) ──
                this.consume();
                const args = [];
                if (!this.match(')')) {
                    args.push(this.parseConditional());
                    while (this.match(',')) {
                        this.consume();
                        args.push(this.parseConditional());
                    }
                }
                this.expect(')');
                node = { type: 'CallExpression', callee: node, args };
            }
            else {
                break;
            }
        }
        return node;
    }
    /**
     * مقادیر پایه: Number، String، Identifier، Parenthesized Expression، یا Object Literal.
     */
    parsePrimary() {
        // SEC FIX (v1.2.6): SEC-A10 — depth guard. parsePrimary is the entry
        // to every nesting level (parens, array literals, object literals,
        // member access via parseMemberOrCall, etc.). If depth exceeds
        // MAX_DEPTH, the input is almost certainly adversarial — throw rather
        // than risk a stack overflow.
        this.depth++;
        if (this.depth > Parser.MAX_DEPTH) {
            throw new Error(`Expression exceeds maximum nesting depth of ${Parser.MAX_DEPTH} — possible stack-overflow / ReDoS attempt.`);
        }
        try {
            return this._parsePrimaryInner();
        }
        finally {
            this.depth--;
        }
    }
    /**
     * Internal: the original body of parsePrimary, called after the depth guard.
     */
    _parsePrimaryInner() {
        const token = this.current();
        if (token.type === TokenType.Number) {
            this.consume();
            return { type: 'Literal', value: token.value };
        }
        if (token.type === TokenType.String) {
            this.consume();
            return { type: 'Literal', value: token.value };
        }
        // ── x => expr (single param without parens) ──
        // نکته: این بررسی باید قبل از Identifier باشد، وگرنه `x` به‌عنوان Identifier
        // مصرف می‌شود و `=>`识别 نمی‌شود.
        if (token.type === TokenType.Identifier && this.peek()?.value === '=>') {
            const paramName = this.consume().value;
            this.consume(); // consume =>
            const body = this.parseConditional();
            return { type: 'ArrowFunction', params: [{ name: paramName }], body };
        }
        if (token.type === TokenType.Identifier) {
            this.consume();
            return { type: 'Identifier', name: token.value };
        }
        // ── Arrow Function: (x) => expr  OR  (x, y) => expr ──
        if (token.value === '(') {
            const savedPos = this.pos;
            try {
                this.consume(); // consume '('
                const params = [];
                if (this.current().value !== ')') {
                    do {
                        if (this.current().type !== TokenType.Identifier)
                            throw new Error('expected identifier');
                        params.push({ name: this.consume().value });
                        if (this.match(',')) {
                            this.consume(); // مصرف کاما
                        }
                        else {
                            break;
                        }
                    } while (true);
                }
                if (this.current().value !== ')')
                    throw new Error('expected )');
                this.consume(); // consume ')'
                if (this.current().value === '=>') {
                    this.consume();
                    const body = this.parseConditional();
                    return { type: 'ArrowFunction', params, body };
                }
                throw new Error('not an arrow function');
            }
            catch {
                this.pos = savedPos;
            }
        }
        if (this.match('(')) {
            // ── (expr) — پرانتز برای تغییر اولویت ──
            this.consume();
            const expr = this.parseConditional();
            this.expect(')');
            return expr;
        }
        // ── [a, b, c] — Array Expression ──
        if (this.match('[')) {
            this.consume();
            const elements = [];
            if (this.current().value !== ']') {
                do {
                    // پشتیبانی از trailing comma: [1, 2, 3,]
                    if (this.match(']'))
                        break;
                    elements.push(this.parseConditional());
                    if (this.match(',')) {
                        this.consume(); // مصرف کاما برای ادامه‌ی loop
                    }
                    else {
                        break; // دیگر کاما نیست → خروج از loop
                    }
                } while (true);
            }
            this.expect(']');
            return { type: 'ArrayExpression', elements };
        }
        if (this.match('{')) {
            return this.parseObjectExpression();
        }
        throw new Error(`Syntax Error at position ${token.start}: unexpected token '${token.value}'`);
    }
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
    parseObjectExpression() {
        this.expect('{');
        const properties = [];
        // شیء خالی: {}
        if (this.match('}')) {
            this.consume();
            return { type: 'ObjectExpression', properties };
        }
        // اولین property
        properties.push(this.parseObjectProperty());
        // property های بعدی (با کاما جدا شده)
        while (this.match(',')) {
            this.consume();
            // پشتیبانی از trailing comma: { a: 1, b: 2, }
            if (this.match('}'))
                break;
            properties.push(this.parseObjectProperty());
        }
        this.expect('}');
        return { type: 'ObjectExpression', properties };
    }
    /**
     * پارس کردن یک property از Object Literal: `key: value`.
     *
     * key می‌تواند:
     *   - Identifier (مثل `active`)
     *   - String Literal (مثل `'text-red'`)
     */
    parseObjectProperty() {
        const token = this.current();
        let key;
        if (token.type === TokenType.String) {
            this.consume();
            key = token.value;
        }
        else if (token.type === TokenType.Identifier) {
            this.consume();
            key = token.value;
        }
        else {
            throw new Error(`Syntax Error at position ${token.start}: ` +
                `expected string or identifier as object key, but got '${token.value}'`);
        }
        this.expect(':');
        const value = this.parseConditional();
        return { key, value };
    }
}
//# sourceMappingURL=parser.js.map