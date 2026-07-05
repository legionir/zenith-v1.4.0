// packages/expressions/src/lexer.ts
//
// Lexer (یا Tokenizer): اولین مرحله از کامپایل Expression.
// رشته‌ی خام ورودی را به دنباله‌ای از Tokenهای معنایی تبدیل می‌کند.
//
// مثال:
//   "$user.age > 18"  →  [Identifier('$user'), '.', Identifier('age'), '>', Number(18)]
//
// نکته‌ی مهم: این ماژول هیچ state سراسری ندارد و کاملاً Pure است.
// یعنی برای هر رشته، همیشه دنباله‌ی Token یکسان تولید می‌شود.
// این خاصیت باعث می‌شود Lexer برای Caching کاملاً مناسب باشد.

/**
 * نوع هر Token در خروجی Lexer.
 *
 * چرا enum به جای string union؟
 *   - Performance: مقایسه‌ی عددی در Parser سریع‌تر است.
 *   - Memory: V8 در حالت استفاده از enum، type narrowing بهتری انجام می‌دهد.
 */
export enum TokenType {
  Number,
  String,
  Identifier,
  Punctuator,
  EOF,
}

/**
 * ساختار یک Token.
 *
 * فیلدهای start و end برای Error Reporting دقیق به کار می‌روند
 * (مثلاً "Error at position 12-15: Unexpected ')'").
 */
export interface Token {
  type: TokenType;
  value: any;
  start: number;
  end: number;
}

/**
 * لیست تمام عملگرها و علائم نگارشی پشتیبانی‌شده.
 *
 * ترتیب در اینجا مهم نیست چون SORTED_PUNCTUATORS در زمان بارگذاری ماژول
 * به ترتیب طول نزولی مرتب می‌شود تا Greedy Matching درست کار کند.
 *
 * چرا ترتیب طول نزولی؟
 *   وقتی به "===" می‌رسیم، ابتدا باید "===" را match کنیم نه "==" را.
 *   اگر "==" اول match شود، "=" باقی می‌ماند که معنا ندارد.
 */
const PUNCTUATORS = [
  '+', '-', '*', '/', '%',
  '??', '?.', '=>',
  '==', '===', '!=', '!==',
  '<', '>', '<=', '>=',
  '&&', '||', '!',
  '?', ':', '.', ',',
  '(', ')', '[', ']',
  '{', '}',
];

// Pre-sort برای جلوگیری از sort در هر iteration حلقه
const SORTED_PUNCTUATORS = [...PUNCTUATORS].sort((a, b) => b.length - a.length);

/**
 * تابع اصلی Lexer: تبدیل رشته به آرایه‌ای از Tokenها.
 *
 * مراحل برای هر کاراکتر:
 *   1) اگر فاصله است، رد شو.
 *   2) اگر `"` یا `'` است، یک String Literal بخوان.
 *   3) اگر رقم است، یک Number بخوان.
 *   4) اگر حرف یا `_` یا `$` است، یک Identifier بخوان.
 *   5) در غیر این صورت، Punctuator را match کن (greedy).
 *
 * در پایان، یک Token نوع EOF اضافه می‌شود تا Parser بداند
 * رشته تمام شده است (بدون نیاز به چک کردن length در هر مرحله).
 *
 * @param input رشته‌ی Expression.
 * @returns آرایه‌ای از Tokenها.
 */
export function lex(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input.charAt(i);

    // ── ۱. نادیده گرفتن فاصله‌های سفید ──
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // ── ۲. String Literals (با پشتیبانی از escape sequences) ──
    if (char === '"' || char === "'") {
      const quote = char;
      const start = i;
      let str = '';
      i++; // از کوتیشن باز عبور کن

      while (i < input.length && input[i] !== quote) {
        // پشتیبانی از escape sequences رایج
        if (input[i] === '\\' && i + 1 < input.length) {
          const next = input[i + 1];
          switch (next) {
            case 'n': str += '\n'; break;
            case 'r': str += '\r'; break;
            case 't': str += '\t'; break;
            case '\\': str += '\\'; break;
            case "'": str += "'"; break;
            case '"': str += '"'; break;
            case '0': str += '\0'; break;
            // FIX (v1.2.4): \uXXXX — Unicode code point escape (4 hex digits).
            // Example: "\u0041" → "A", "\u1F600" — wait, that's 5 digits.
            // Spec-compliant \u takes exactly 4 hex digits. For code points
            // above U+FFFF users must use surrogate pairs (\uD83D\uDE00).
            case 'u': {
              const hex = input.slice(i + 2, i + 6);
              if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                str += String.fromCharCode(parseInt(hex, 16));
                i += 4; // skip the 4 hex digits (the '\\u' +2 is added below)
              } else {
                // Malformed \u — emit 'u' literally (matches old default behavior).
                str += next;
              }
              break;
            }
            // FIX (v1.2.4): \xXX — Latin-1 hex escape (2 hex digits).
            // Example: "\x41" → "A", "\x0A" → "\n".
            case 'x': {
              const hex = input.slice(i + 2, i + 4);
              if (/^[0-9a-fA-F]{2}$/.test(hex)) {
                str += String.fromCharCode(parseInt(hex, 16));
                i += 2; // skip the 2 hex digits
              } else {
                str += next;
              }
              break;
            }
            default: str += next; // سایر escapeها: همان کاراکتر بعدی
          }
          i += 2;
        } else {
          str += input[i++];
        }
      }
      i++; // از کوتیشن بسته عبور کن

      tokens.push({
        type: TokenType.String,
        value: str,
        start,
        end: i,
      });
      continue;
    }

    // ── ۲‌ب. Template Literals (backtick) — Full ${} support ──
    //
    // `` `hello ${$name} world` `` تبدیل می‌شود به tokens:
    //   String("hello ") + Identifier("$name") + String(" world")
    //
    // این کار با emit کردن alternating String و + tokens انجام می‌شود.
    // Parser به‌طور طبیعی این را به‌عنوان BinaryExpression با + parse می‌کند.
    if (char === '`') {
      const start = i;
      i++; // از backtick باز عبور کن

      // اگر خالی بود: `` → empty string
      if (input[i] === '`') {
        i++;
        tokens.push({ type: TokenType.String, value: '', start, end: i });
        continue;
      }

      // اگر اولین کاراکتر ${ نبود، یک String token برای بخش متنی emit کن.
      let firstPart = true;

      while (i < input.length && input[i] !== '`') {
        // ── بررسی ${...} ──
        if (input[i] === '$' && input[i + 1] === '{') {
          // اگر متن قبل از ${} وجود داشت، آن را به‌عنوان String emit کن.
          // (در iteration های بعدی مدیریت می‌شود)

          // FIX (B-1): اگر اولین بخش template literal است (بدون متن قبل از ${})
          // یک String خالی + عملگر + اضافه می‌کنیم تا همیشه string concatenation
          // انجام شود. بدون این fix، `${a}${b}` با a=1 و b=2، + بین دو Identifier
          // باعث جمع عددی (3) می‌شود به‌جای الحاق رشته‌ای ("12").
          if (firstPart) {
            tokens.push({ type: TokenType.String, value: '', start: i, end: i });
            tokens.push({ type: TokenType.Punctuator, value: '+', start: i, end: i });
          }

          // + operator قبل از expression (مگر اینکه اولین بخش باشد)
          if (!firstPart) {
            tokens.push({ type: TokenType.Punctuator, value: '+', start: i, end: i });
          }

          // عبور از ${
          i += 2;

          // جمع‌آوری expression داخل {} — با شمارش brace depth.
          let expr = '';
          let depth = 1;
          while (i < input.length && depth > 0) {
            if (input[i] === '{') depth++;
            else if (input[i] === '}') { depth--; if (depth === 0) break; }
            expr += input[i++];
          }
          if (depth !== 0) {
            throw new Error(`Unterminated template literal interpolation at position ${start}`);
          }
          i++; // از } عبور کن

          // Expression را lex کن و tokens آن را به tokens اصلی اضافه کن.
          // نکته‌ی مهم: lex همیشه یک EOF token در انتها اضافه می‌کند. چون ما
          // tokens را در middle of stream اضافه می‌کنیم، EOF باید فیلتر شود
          // تا parser در میانه‌ی کار به EOF نرسیده و خطا ندهد.
          const allExprTokens = lex(expr);
          const exprTokens = allExprTokens.filter(t => t.type !== TokenType.EOF);
          // اگر یک token داشت (مثل یک Identifier یا Literal)، مستقیم emit کن.
          if (exprTokens.length === 1) {
            tokens.push(exprTokens[0]!);
          } else {
            tokens.push({ type: TokenType.Punctuator, value: '(', start: i, end: i });
            for (const t of exprTokens) tokens.push(t);
            tokens.push({ type: TokenType.Punctuator, value: ')', start: i, end: i });
          }

          firstPart = false;
          continue;
        }

        // ── بخش متنی (غیر از ${}) ──
        // جمع‌آوری متن تا ${ یا ` یا پایان.
        let textContent = '';
        while (i < input.length && input[i] !== '`' && !(input[i] === '$' && input[i + 1] === '{')) {
          if (input[i] === '\\' && i + 1 < input.length) {
            const next = input[i + 1];
            switch (next) {
              case 'n': textContent += '\n'; break;
              case 'r': textContent += '\r'; break;
              case 't': textContent += '\t'; break;
              case '\\': textContent += '\\'; break;
              case '`': textContent += '`'; break;
              case '$': textContent += '$'; break;
              // FIX (v1.2.4): \uXXXX and \xXX in template literals too —
              // keep parity with regular string literals above.
              case 'u': {
                const hex = input.substr(i + 2, 4);
                if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                  textContent += String.fromCharCode(parseInt(hex, 16));
                  i += 4;
                } else {
                  textContent += next;
                }
                break;
              }
              case 'x': {
                const hex = input.substr(i + 2, 2);
                if (/^[0-9a-fA-F]{2}$/.test(hex)) {
                  textContent += String.fromCharCode(parseInt(hex, 16));
                  i += 2;
                } else {
                  textContent += next;
                }
                break;
              }
              default: textContent += next;
            }
            i += 2;
          } else {
            textContent += input[i++];
          }
        }

        // + operator قبل از string (مگر اینکه اولین بخش باشد)
        if (!firstPart && textContent.length > 0) {
          tokens.push({ type: TokenType.Punctuator, value: '+', start: i, end: i });
        }

        if (textContent.length > 0 || firstPart) {
          tokens.push({ type: TokenType.String, value: textContent, start: i - textContent.length, end: i });
          firstPart = false;
        }
      }

      if (input[i] !== '`') {
        throw new Error(`Unterminated template literal at position ${start}`);
      }
      i++; // از backtick بسته عبور کن
      continue;
    }

    // ── ۳. Number Literals ──
    // از regex دقیق استفاده می‌کنیم که فقط یک نقطه‌ی اعشار مجاز می‌داند.
    // این از silent failure جلوگیری می‌کند (مثلا 1..2 یا 3.14.15).
    if (/[0-9]/.test(char)) {
      // match از position فعلی شروع می‌شود و یک عدد معتبر را capture می‌کند.
      // الگو: ۱+ رقم، سپس (اختیاری) نقطه + ۱+ رقم.
      const match = input.slice(i).match(/^[0-9]+(\.[0-9]+)?/);
      if (match) {
        const num = match[0];
        i += num.length;
        tokens.push({
          type: TokenType.Number,
          value: parseFloat(num),
          start: i - num.length,
          end: i,
        });
        continue;
      }
      // اگر regex بالا match نکرد (نباید رخ دهد چون char عدد است)،
      // به‌عنوان fallback فقط یک رقم بخوانیم.
      tokens.push({
        type: TokenType.Number,
        value: parseFloat(char),
        start: i,
        end: i + 1,
      });
      i++;
      continue;
    }

    // ── ۴. Identifiers (شامل $) ──
    if (/[a-zA-Z_$]/.test(char)) {
      let id = '';
      while (i < input.length && /[a-zA-Z0-9_$]/.test(input.charAt(i))) {
        id += input.charAt(i++);
      }
      tokens.push({
        type: TokenType.Identifier,
        value: id,
        start: i - id.length,
        end: i,
      });
      continue;
    }

    // ── ۵. Punctuators (با Greedy Matching) ──
    let matched = false;
    for (const p of SORTED_PUNCTUATORS) {
      if (input.substr(i, p.length) === p) {
        tokens.push({
          type: TokenType.Punctuator,
          value: p,
          start: i,
          end: i + p.length,
        });
        i += p.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      throw new Error(`Unexpected character: '${char}' at position ${i}`);
    }
  }

  // ── اضافه کردن Token پایان ──
  tokens.push({ type: TokenType.EOF, value: null, start: i, end: i });
  return tokens;
}
