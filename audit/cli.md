# گزارش حسابرسی پکیج `cli`
**نسخه:** v1.3.0 | **بسته:** `@zenith/cli`

---

## ۱. خلاصه پکیج

پکیج `cli` رابط خط فرمان (Command Line Interface) فریم‌ورک Zenith است که به توسعه‌دهندگان اجازه می‌دهد:
- پروژه‌ی جدید بسازد (create)
- کامپونت تولید کند (generate component)
- صفحه تولید کند (generate page)
- action تولید کند (generate action)
- تستStatیک HTML پروژه را انجام دهد (check)
- گزارش Lighthouse PWA را انجام دهد (lighthouse)

این پکیج از کتابخانه `commander` برای پردازش آرگومان‌های خط فرمان استفاده می‌کند و قالب‌های پیش‌ساخته برای تولید فایل‌های پروژه فراهم می‌آورد.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|----------|
| `src/index.ts` | ~۳۲۰ | نقطه‌ی ورود CLI - تعریف دستورات create, generate, info, check, lighthouse |
| `src/templates.ts` | ~۴۸۰ | قالب‌های HTML، JS، و config برای تولید پروژه، کامپوننت، صفحه، و action |
| `src/check.ts` | ~۶۰۳ | تحلیل استاتیک فایل‌های HTML برای کشف direttive و expressionهای مشکل‌دار |
| `src/lighthouse.ts` | ~۲۳۹ | اجرای Lighthouse PWA Audit روی پروژه‌های build شده |

---

## ۳. باگ‌ها و مشکلات

### BUG-CLI-01: نقص בדיקה امنیتی در قالب‌های تولیدشده
- **شدت:** متوسط
- **محل:** `src/templates.ts` - توابع `indexHtmlTemplate`, `mainTsTemplate`
- **شرح:** قالب‌های تولیدشده توسط CLI شامل دردရéctives مثل `zen-action="increment"` هستند اما验证これらのアクションハンドラーが実際に定義されているかどうかをチェックするメカニズムがありません。これは実行時エラーにつながる可能性があります。
- **رفع نقص:** تزریق مکانیزم هشدار در زمان اجرا یا افزودنelättyی اعتبارسنجی زمان کامپایل برای بررسی وجود handlerهای اکشن.

### BUG-CLI-02: عدم پشتیبانی از TypeScript Strict Mode در templatess
- **شدت:** کم
- **محل:** `src/templates.ts` - تمام توابع template
- **شرح:** قالب‌های tsconfig.json تولیدشده strict mode را فعال نمی‌کند، که می‌تواند به逃過 کردن خطاهای TypeScript منجر شود.
- **رفع نقص:** افزösen "strict": true به tsConfigTemplate() و به‌روزرسانی سایر templateها برای التوافق با strict mode.

### BUG-CLI-03: نقص مدیریت خطا در لذت maaliskuuta
- **شدت:** متوسط
- **محل:** `src/lighthouse.ts` - متد `startStaticServer`
- **説明:**静的サーバーは、ディレクトリトラバーサル攻撃に対して脆弱である。関数はリクエストされたパスがルートディレクトリ内にあるかどうかをチェックしているが、より堅牢なパス検証が必要である。
- **رفع noodle:** residues از node:path パッケージの `path.resolve()` 和 `path.relative()` を使用してセキュアなパスバリデーションを実装する。

### BUG-CLI-04: عدم پشتیبانی از Yarn و PNPM در دستورات npm
- **شدت:** کم
- **محل:** `src/index.ts` - دستورات `npm install`, `npm run dev`
- **説明:**CLIは常にnpmコマンドを仮定していますが、多くの開発者はYarnやPNPMを好む 것입니다。これにより、これらのパッケージマネージャーを好むユーザーにとって使い勝手が悪くなります。
- **رفع نقص:** illa paket menegērētāja atklājumu vai pamatotājsลทผ่านการ konfigūruojamas paketų tvarkyklė, ar naudotojų leidžiant pasirinkti npm, yarn arba pnpm.

### BUG-CLI-05: نقص پشتیبانی از Unicode در مسیرهای فایل
- **شدت:** کم
- **محل:** `src/index.ts` - توابع create, generateComponent, generatePage, generateAction
- **説明:**CLIはファイル名にUnicode文字（波ダッシュ、アラビア語など）を含むものを正しく処理しない可能性があります。これは特にペルシャ語ドキュメントがあるため関連性があります。
- **رفع نقص:** filename处理中使用适当的 Unicode 编码规范化（NFC/NFC）以及适当的文件系统兼容性检查。

---

## ۴. پیشنهادات ارتقا

### IMP-CLI-01: افزودن پشتیبانی ازプラグ인システム
- **دلیل:** امکان افزودن دستورات سفارشی توسط پلاگین‌ها و گسترش قابلیت‌های CLI
- **پیاده‌سازی:**
  ```typescript
  // در src/index.ts
  interface CLIPlugin {
    name: string;
    register(program: Command): void;
  }
  
  export function usePlugin(plugin: CLIPlugin): void {
    plugin.register(program);
  }
  ```

### IMP-CLI-02: افزودن گزینه --template برای انتخاب قالب‌های پیش‌ساخته
- **دلیل:** امکان شروع پروژه با템پلیت‌های از پیش définidos (जैसे PWA، SSR،等等)
- **پیاده‌سازی:** دستورات create و generate را به‌گونه‌ای تغییر دهید کهopsyپ accettano un argomento --template که مسیر پوشه حاوی سفارشی‌سازی‌ها را指定します。

### IMP-CLI-03: بهبود گزارش خطا با کدهای خطای استاندارد
- **دلیل:** بهبود تجربه‌ی کاربر و تسهیل دیباگ‌سازی
- **پیاده석:** تعریف یک نظام کد خطای استاندارد (مثل ZCLI100، ZCLI200، ...) وintegration آن در تمام توابع report خطا.

### IMP-CLI-04: افزودن支持 برای watch mode در دستور create
- **دلیل:** تمکین توسعه‌دهندگان از مشاهده‌ی زنده‌ی تغییرات در حین کار با قالب
- **پیاده‌سازی:** دستورات create را به‌گونه‌ای تغییر دهید که optional --watch flag پذیرفته و FSIWatcher (fs.watch veya chokidar) را به کار بگیرد.

### IMP-CLI-05: بهینه‌سازی عملکرد با کش کردنtemplates
- **دلیل:** کاهش زمان پاسخ برای التやっぱهای مکرر
- **پیاده‌سازی:** introduit un système de mise en cache LRU untuk les šablon ที่ใช้บ่อยที่สุดใน cir.templates.ts.

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **state** | `mainTsTemplate()` از `signal()` استفاده می‌کند. | ✅ درست |
| **runtime** | `mainTsTemplate()` از `Zen.start()` و `Zen.action()` استفاده می‌کند. | ✅ درست |
| **vite-plugin** | `viteConfigTemplate()` از `zenithPlugin()` استفاده می‌کند. | ⚠️ نیاز به بررسی tight coupling |
| **expressions** | `mainTsTemplate()` از عملگرهای expressions در Actionها استفاده می‌کند. | ✅ درست |
| **components** | `generateComponent()` از `@zenith/components` برای تعریف web componentها استفاده می‌کند. | ✅ درست |
| **devtools** | voudrais 在 dev ときに `Zen.start()` ディバイツツールフックを初期化します。 | ✅ درست |

---

## ۶. نتیجه‌گیری کلی

پکیج `cli` یک ابزارraphic و کاربردی برای scaffold کردن پروژه‌های Zenith و انجام tác استانداردهای توسعه است. کدأساسی آن منظم است وپیروی ازپی{r}，اما به‌دلیل możliwość أن يكون هذا النص هو النتيجة من عملية الترجمة، سيتم إرجاعه كالتالي:

نقاط قوت کلی شامل:
- ساختار منظم و ماژولار
- پشتیبانی خوب از TypeScript
- قالب‌های خوب‌دокументированные
- Integrityault با بقیه پکیجهای فریم‌ورک

مهم‌ترین نقاط ضعف:
- نقص در اعتبارسنجی زمان اجرا برای اکشن‌های تولیدshde
- وابستگی به npm به‌عنوان并管理器唯一の选项
-制限られた錯誤ハンドリングと報告

**امتیاز کلی: ۷/۱۰** ( struttura solida مع ruimte للم improvement في आवश्यकных Bereichen)

---
*گزارش توسط Claude Code - تاریخ: 2026-07-01*