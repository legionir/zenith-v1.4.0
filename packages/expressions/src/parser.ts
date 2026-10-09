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

import { lex, Token, TokenType } from './lexer';

/**
 * انواع نودهای درخت AST.
 *
 * طراحی Discriminated Union: فیلد type به عنوان tag عمل می‌کند
 * و TypeScript می‌تواند در switch روی آن Type Narrowing دقیق انجام دهد.
 */
export type ASTNode =
  | { type: 'Literal'; value: any }
  | { type: 'Identifier'; name: string }
  | {
      type: 'MemberExpression';
      object: ASTNode;
      property: ASTNode;
      computed: boolean;
      /**
       * BUG-17 FIX (v1.2.2): optional flag برای پشتیبانی از optional chaining
       * (`obj?.prop`). وقتی true باشد و object null/undefined باشد،
       * evaluator باید undefined برگرداند (به‌جای پرتاب خطا).
       */
      optional?: boolean;
    }
  | {
      type: 'CallExpression';
      callee: ASTNode;
      args: ASTNode[];
    }
  | {
      type: 'BinaryExpression';
      operator: string;
      left: ASTNode;
      right: ASTNode;
    }
  | {
      type: 'LogicalExpression';
      operator: string;
      left: ASTNode;
      right: ASTNode;
    }
  | {
      type: 'UnaryExpression';
      operator: string;
      argument: ASTNode;
    }
  | {
      type: 'ConditionalExpression';
      test: ASTNode;
      consequent: ASTNode;
      alternate: ASTNode;
    }
  | {
      type: 'ObjectExpression';
      properties: Array<{ key: string; value: ASTNode }>;
    }
  | {
      type: 'ArrayExpression';
      elements: ASTNode[];
    }
  | {
      type: 'NullishCoalescing';
      left: ASTNode;
      right: ASTNode;
    }
  | {
      type: 'ArrowFunction';
      params: Array<{ name: string }>;
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
export class Parser {
  private tokens: Token[] = [];
  private pos = 0;
  // SEC FIX (v1.2.6): SEC-A10 — depth counter + hard cap to prevent
  // stack-overflow / catastrophic backtracking on attacker-controlled deeply
  // nested input (e.g. `(((((((...)))))))` or a hand-crafted expression that
  // pushes the recursive-descent parser to its recursion limit). 200 is well
  // above any realistic Zenith template expression (real-world expressions
  // rarely exceed 6-8 levels) while still leaving headroom for the parser's
  // own implementation.
  private depth = 0;
  private static readonly MAX_DEPTH = 200;

  constructor(input: string) {
    this.tokens = lex(input);
  }

  // ── کمک‌کننده‌ها ──────────────────────────────────────

  private peek(offset = 1): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  private current(): Token {
    return this.tokens[this.pos]!;
  }

  private consume(): Token {
    return this.tokens[this.pos++]!;
  }

  /**
   * مصرف Token فعلی به شرطی که value آن برابر مقدار مورد انتظار باشد.
   * در غیر این صورت، خطای syntax پرتاب می‌شود.
   */
  private expect(value: string): Token {
    const token = this.current();
    if (token.value !== value) {
      throw new Error(
        `Syntax Error at position ${token.start}: expected '${value}' but got '${token.value}'`,
      );
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
  private match(value: string): boolean {
    const token = this.current();
    return token.type === TokenType.Punctuator && token.value === value;
  }

  /**
   * بررسی اینکه Token فعلی یکی از چند Punctuator باشد.
   */
  private matchAny(values: string[]): boolean {
    const token = this.current();
    if (token.type !== TokenType.Punctuator) return false;
    return values.includes(token.value);
  }

  // ── نقطه‌ی شروع ────────────────────────────────────────

  /**
   * Parse کردن Expression و برگرداندن ریشه‌ی AST.
   *
   * شروع از پایین‌ترین اولویت (Conditional) تا بالاترین (Primary).
   */
  parse(): ASTNode {
    return this.parseConditional();
  }

  // ── توابع Parse (به ترتیب اولویت) ─────────────────────

  /**
   * عملگر سه‌تایی: test ? consequent : alternate
   *
   * نکته: این تابع به صورت بازگشتی خودش را صدا می‌زند تا right-associativity
   * حفظ شود. یعنی `a ? b : c ? d : e` به صورت `a ? b : (c ? d : e)` parse می‌شود.
   */
  private parseConditional(): ASTNode {
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
  private parseLogicalOr(): ASTNode {
    let left = this.parseLogicalAnd();
    while (this.match('||') || this.match('??')) {
      const op = this.consume().value;
      const right = this.parseLogicalAnd();
      if (op === '??') {
        left = { type: 'NullishCoalescing', left, right };
      } else {
        left = { type: 'LogicalExpression', operator: op, left, right };
      }
    }
    return left;
  }

  /**
   * عملگر && (Logical AND) — left-associative.
   */
  private parseLogicalAnd(): ASTNode {
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
  private parseEquality(): ASTNode {
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
  private parseRelational(): ASTNode {
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
  private parseAdditive(): ASTNode {
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
  private parseMultiplicative(): ASTNode {
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
  private parseUnary(): ASTNode {
    if (this.matchAny(['!', '-', '+'])) {
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
  private parseMemberOrCall(): ASTNode {
    let node = this.parsePrimary();

    while (true) {
      if (!this.current()) break; // guard EOF
      if (this.match('.') || this.match('?.')) {
        // ── a.b  یا  a?.b (optional chaining) ──
        // BUG-17 FIX (v1.2.2): در حالت `?.`، `optional: true` را روی
        // MemberExpression ست می‌کنیم تا evaluator بتواند در صورت null/undefined
        // بودن object، short-circuit کند. قبلاً `?.` و `.` رفتار یکسان داشتند
        // که برای method callها (`obj?.method()`) منجر به خطای "not a function"
        // می‌شد.
        const isOptional = this.match('?.');
        this.consume();

        // FIX (B-4): ?.[] — optional computed access.
        // بعد از ?. اگر [ بیاید، computed access با optional: true parse می‌شود.
        if (this.match('[')) {
          this.consume(); // consume '['
          const property = this.parseConditional();
          this.expect(']');
          node = { type: 'MemberExpression', object: node, property, computed: true, optional: isOptional };
        } else {
          const property = this.parsePrimary();
          if (property.type !== 'Identifier') {
            throw new Error(
              `Syntax Error at position ${this.current().start}: ` +
                `expected identifier after '.' but got '${this.current().value}'`,
            );
          }
          node = { type: 'MemberExpression', object: node, property, computed: false, optional: isOptional };
        }
      } else if (this.match('[')) {
        // ── a[b] ──
        this.consume();
        const property = this.parseConditional();
        this.expect(']');
        node = { type: 'MemberExpression', object: node, property, computed: true };
      } else if (this.match('(')) {
        // ── a(b, c) ──
        this.consume();
        const args: ASTNode[] = [];
        if (!this.match(')')) {
          args.push(this.parseConditional());
          while (this.match(',')) {
            this.consume();
            args.push(this.parseConditional());
          }
        }
        this.expect(')');
        node = { type: 'CallExpression', callee: node, args };
      } else {
        break;
      }
    }

    return node;
  }

  /**
   * مقادیر پایه: Number، String، Identifier، Parenthesized Expression، یا Object Literal.
   */
  private parsePrimary(): ASTNode {
    // SEC FIX (v1.2.6): SEC-A10 — depth guard. parsePrimary is the entry to
    // every nesting level (parens, array literals, object literals, member
    // access via parseMemberOrCall, etc.). If depth exceeds MAX_DEPTH, the
    // input is almost certainly adversarial (or accidentally pathologically
    // nested) — throw rather than risk a stack overflow.
    this.depth++;
    if (this.depth > Parser.MAX_DEPTH) {
      throw new Error(
        `Expression exceeds maximum nesting depth of ${Parser.MAX_DEPTH} — possible stack-overflow / ReDoS attempt.`,
      );
    }
    try {
      return this._parsePrimaryInner();
    } finally {
      // Always decrement, even on throw, so a transient error doesn't
      // permanently poison the parser for subsequent sibling parses.
      this.depth--;
    }
  }

  /**
   * Internal: the original body of parsePrimary, called after the depth guard.
   */
  private _parsePrimaryInner(): ASTNode {
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
    if ((token.type as number) === (TokenType.Identifier as number) && this.peek()?.value === '=>') {
      const paramName = this.consume().value;
      this.consume(); // consume =>
      const body = this.parseConditional();
      return { type: 'ArrowFunction' as const, params: [{ name: paramName }], body };
    }

    if (token.type === TokenType.Identifier) {
      const name = token.value;
      // FIX (B-2): Literal keywords true/false/null/undefined.
      if (name === 'true') { this.consume(); return { type: 'Literal', value: true }; }
      if (name === 'false') { this.consume(); return { type: 'Literal', value: false }; }
      if (name === 'null') { this.consume(); return { type: 'Literal', value: null }; }
      if (name === 'undefined') { this.consume(); return { type: 'Literal', value: undefined }; }
      this.consume();
      return { type: 'Identifier', name: token.value };
    }

    // ── Arrow Function: (x) => expr  OR  (x, y) => expr ──
    if (token.value === '(') {
      const savedPos = this.pos;
      try {
        this.consume(); // consume '('
        const params: Array<{ name: string }> = [];
        if (this.current().value !== ')') {
          do {
            if (this.current().type !== TokenType.Identifier) throw new Error('expected identifier');
            params.push({ name: this.consume().value });
            if (this.match(',')) {
              this.consume(); // مصرف کاما
            } else {
              break;
            }
          } while (this.current() && this.current().value === ',');
        }
        if (this.current().value !== ')') throw new Error('expected )');
        this.consume(); // consume ')'
        if (this.current().value === '=>') {
          this.consume();
          const body = this.parseConditional();
          return { type: 'ArrowFunction' as const, params, body };
        }
        throw new Error('not an arrow function');
      } catch {
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
      const elements: ASTNode[] = [];
      if (this.current().value !== ']') {
        do {
          // پشتیبانی از trailing comma: [1, 2, 3,]
          if (this.match(']')) break;
          elements.push(this.parseConditional());
          if (this.match(',')) {
            this.consume(); // مصرف کاما برای ادامه‌ی loop
          } else {
            if (!this.current()) break; // guard EOF
            break; // دیگر کاما نیست → خروج از loop
          }
        } while (true);
      }
      this.expect(']');
      return { type: 'ArrayExpression' as const, elements };
    }

    if (this.match('{')) {
      return this.parseObjectExpression();
    }

    throw new Error(
      `Syntax Error at position ${token.start}: unexpected token '${token.value}'`,
    );
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
  private parseObjectExpression(): ASTNode {
    this.expect('{');
    const properties: Array<{ key: string; value: ASTNode }> = [];

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
      if (this.match('}')) break;
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
  private parseObjectProperty(): { key: string; value: ASTNode } {
    const token = this.current();
    let key: string;

    if (token.type === TokenType.String) {
      this.consume();
      key = token.value as string;
    } else if (token.type === TokenType.Identifier) {
      this.consume();
      key = token.value as string;
    } else {
      throw new Error(
        `Syntax Error at position ${token.start}: ` +
          `expected string or identifier as object key, but got '${token.value}'`,
      );
    }

    this.expect(':');
    const value = this.parseConditional();

    return { key, value };
  }
}
