# گزارش حسابرسی پکیج `ssr`
**نسخه:** v1.3.0 | **بسته:** `@zenith/ssr`

---

## ۱. خلاصه پکیج

پکیج `ssr` (Server-Side Rendering) فریم‌ورک Zenith responsável برای_render کردن به رشته (render-to-string) و streaming SSR با پشتیبانی از hydration و Server Components است.

مسئوليات اصلی:
- **renderToString**: رندر synchronously HTML از 템پلیت و state، با استفاده از JSDOM و izolatsiya از global state از طریق AsyncLocalStorage.
- **renderToStream**: streaming SSR با injекцию state در head chunk.
- **generateHydrationScript** و **generateFullPage**: تولید اسکریپت hydration و صفحه کامل برای ارسال به کلاینت.
- **hydrate** و **startFromSSR**:hidration واقعی در کلاینت (به کار بردن از state سروری و adoptdng existing DOM).
- **Server Components**: کامپوننت‌های سروری که کامل در سرور render می‌شوند و در کلاینت hydrate نمی‌شوند (از طریق کامنت‌های marker).
- **AsyncLocalStorage-based isolation**: جلوگیری از race condition در SSR concurrent با ذخیره DOM globals و EffectContext در اس verità async context.
- **Security fixes**: escaping危险な文字 (<, >, U+2028, U+2029) در script tags و بررسی مسیرهای نامعتبر برای جلوگیری از突破 `<script>` 태그.

 این پکیج به بسته‌های `@zenith/runtime`, `@zenith/scheduler`, `@zenith/router` و `@types/node` وابسته است وpeerDependency به `jsdom` دارد.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|----------|
| `src/index.ts` | ~49 | re-export توابع و types اصلی از سایر ماژول‌ها |
| `src/dom-context.ts` | ~167 | managing DOM globals via AsyncLocalStorage for thread‑safe SSR |
| `src/hydrate.ts` | ~300 | hydration logic (adopting existing DOM, state deserialization, server‑component skipping) |
| `src/render.ts` | ~314 | renderToString, renderToStream, generateHydrationScript, generateFullPage, plus security helpers |
| `src/server-component.ts` | ~494 | تعریف، ثبت، رندر و اینलайн کردن Server Components (SSR‑only) |

---

## ۳. باگ‌ها و مشکلات

### BUG-SSR-01: Potential XSS via unescaped route in hydration script
- **شدت:** متوسط
- **محل:** `src/render.ts` – `generateHydrationScript` function, lines 226-241
- **توضیح:** aunque `safeScriptValue` se aplica al `state` y se verifica la seguridad de la ruta con `isRouteSafe`, el `route` se inserta directamente en el script de hidratación como `window.__ZENITH_ROUTE__=${safeScriptValue(JSON.stringify(result.route))};`. Sin embargo, la comprobación `isRouteSafe` solo rechaza las cadenas que contienen `</`. Esto **no** protege contra secuencias como `<\/script>` (que después de `JSON.stringify` se convierte en `"<\\/script>"` y luego se escapa como `\\u003c\\/script>` – en realidad seguro). Pero existe un riesgo si la ruta contiene caracteres de control o Unicode que puedan ser interpretados de manera peligrosa en ciertos contextos (por ejemplo, U+2028/U+2029 ya se escapan en `safeScriptValue`). Sin embargo, la función `safeScriptValue` ya se aplica a la ruta en `generateHydrationScript` (línea 237), por lo que el riesgo es bajo. No obstante, la consistencia sugiere aplicar también `safeScriptValue` al `state` y `route` en el mismo punto (ya se hace). La mejora sería asegurarse de que **todos** los valores insertados en el script (incluido el `state` y `route`) pasen por `safeScriptValue`, lo cual ya ocurre.
- **提案の修正:** 現状でも `safeScriptValue` は state と route に適用されていますが、コメントを明確にし、将来的な変更で見逃されないようにするため、`generateHydrationScript` 内で両方に対して同じサニタイズを適用していることを強調するコメントを追加してください。

### BUG-SSR-02: Missing cleanup of AsyncLocalStorage store on early return/error
- **شدت:** کم
- **محل:** `src/render.ts` – `renderToString` function, lines 104-224
- **توضیح:**関数内では `setEffectContextStoreOnce()` が呼び出され、`domAls.run(domGlobals, () => doRender())` または `runWithRoute` コールバック内で実行されます。ただし、`doRender` 内で例外が発生した場合（例えば、ルート要素が見つからない、または `Zen.start` が失敗した場合）、`finally` ブロック内の `dom.window.close()` は実行されますが、`domAls` のストアは自動的にクリアされます（`run` コールバックが終了するときに）。ただし、`runWithRoute` が使用される場合、`runWithRoute` 自体が Promise を返し、その Promise が reject された場合、`finally` ブロックは依然として実行されますが、内部の `domAls.run` コールバックが実行されない可能性があります（なぜなら `runWithRoute` が早く reject するため）。この場合、`domAls` の store はまだアクティブのままになる可能性があります（ただし、`runWithRoute` の内部で同様に `run` が使われていると仮定すると、最終的にクリアされるはずです）。ただし、明示的に `finally` ブロックで `domAls.run` が終了したことを確認するか、`runWithRoute` のラッパーで同様に `finally` を使うほうが安全です。
- **提案の修正:** `runWithRoute` をラップするラムダ内で `try/finally` を使用し、内部の `domAls.run` が正しく終了することを保証してください。または、`runWithRoute` 自身が `finally` ブロックで同様のクリーンアップを行うことを確認してください（ただし、これは `@zenith/router` 側の実装に依存します）。

### BUG-SSR-03: Potential memory leak in server-component registry during HMR
- **شدت:** متوسط
- **محل:** `src/server-component.ts` – `registerServerComponent` function, lines 68-76
- **توضیح:** `registerServerComponent` 関数は、同じ名前のコンポーネントが既に登録されている場合でも、それを上書きします（HMR に便利というコメントあり）。ただし、このレジストリはモジュールレベルの `Map` (`serverComponentRegistry`) です。HMR シナリオでは、古いモジュールが完全に破棄されず、古いコンポーネント参照がレジストリに残っている可能性があります。これにより、古いコンポーネントが参照され続け、メモリリークが発生する可能性があります。現在の実装では、`unregisterServerComponent` や `clearServerComponents` を呼び出すことで手動でクリアできますが、HMR フックがこれらを自動的に呼び出すわけではありません。
- **提案の修正:** HMR サポートを強化するために、`registerServerComponent` 内で既存のエントリがあれば警告を出すか、あるいは `unregisterServerComponent` を自動的に呼び出してから新しいエントリを設定する（ただし、これにより state が失われる可能性があるため、慎重に）。あるいは、HMR フック（たとえば `@zenith/vite-plugin` 側）で `clearServerComponents` を呼び出す仕組みを提供する。

### BUG-SSR-04: Incomplete error handling for missing JSDOM in browser-like environments
- **شدت:** متوسط
- **محل:** `src/render.ts` – `renderToString` function, lines 129-133
- **توضیح:** `renderToString` 内で JSDOM のインポートに失敗した場合、`ssrEnvironmentError('jsdom-missing')` を投げます。これはサーバーサイド(Node.js)では適切ですが、ブラウザーやそれに類似した環境（たとえば、サービスワーカーや一部のテスト環境）で誤って呼ばれた場合、このエラーメッセージは適切でない可能性があります。なぜなら、ブラウザーでは JSDOM が不要であり、代わりにネイティブ DOM を使うべきだからです。ただし、このパッケージはサーバーサイド専用と考えられているため、ブラウザーでの使用はサポート外と見なすこともできます。しかし、エラーメッセージに「この関数はサーバーサイドでのみ使用してください」といったヒントを加えると、開発者の混乱を減らせるでしょう。
- **提案の修正:** `ssrEnvironmentError` 関数のメッセージを強化し、 Node.js 環境でのみ呼び出すべきことを明記してください（例: `"JSDOM is missing. This function should only be called in a Node.js environment with jsdom installed."`）。

### BUG-SSR-05: Potential issue with nested server-component tags and marker comment parsing
- **شدت:** متوسط
- **محل:** `src/server-component.ts` – `findServerComponentTags` function (inside `singlePass`), lines ~201-210 (regex based)
- **توضیح:** Server Component のタグ検出は正規表ベースで行われており、ネストされたタグや属性内に似たような文字列が含まれている場合に誤検出が発生する可能性があります。たとえば、`<zen-server-component name="outer"><zen-server-component name="inner"/></zen-server-component>` のようなネストは、現在の実装では内側のタグも見つけられますが、置換ロジックが「後ろから前へ」置換を行うため、正しく動作するはずです。ただし、属性値に `<!--zenith-server-component:` などの文字列が含まれていると、誤検出のリスクがあります。現在の正規表現はタグ名のみを対象としているため、属性値内の誤検出は防げていますが、完全な HTML パーサを使わない限り、エッジケースはゼロにはなりません。
- **提案の修正:** セキュリティと堅牢性を考えると、実際の HTML パーサ（たとえば、`linkedom` または `htmlparser2`）を使った実装に移行することを検討してください。ただし、これによりバンドルサイズが増加するため、SSR 用の軽量実装として現在のアプローチを維持し、ドキュメントで制限を明記するのも一つの手です。

### BUG-SSR-06: Lack of timeout or cancellation support in renderToStream
- **شدت:** کم
- **محل:** `src/render.ts` – `renderToStream` function, lines 265-313
- **توضیح:** `renderToStream` は非同期ジェネレータですが、呼び出し側がイテレーションを中断した場合（たとえば、クライアントが接続を切断した場合でも）、内部で進行中の `renderToString` 呼び出しはキャンセルされず、フルレンダーが完了するまで実行され続けます。これにより、不要な CPU とメモリの消費が発生します。特に大規模なテンプレートでは問題になります。
- **提案の修正:** `AbortSignal` をサポートするようにインターフェースを拡張し、`renderToString` 内でそのシグナルを監視して早期終了できるようにします。たとえば、引数に `{ signal?: AbortSignal }` を追加し、`renderToString` 内で定期的にチェックするか、または Promise.race を使ってタイムアウトまたは abort を検出します。

### BUG-SSR-07: Potential double-render of server components in inlineServerComponents loop
- **شدت:** کم
- **محل:** `src/server-component.ts` – `inlineServerComponents` function, lines 481-493
- **توضیح:** `inlineServerComponents` は `MAX_PASSES` (デフォルト 10) 回までループし、各パスでまだ見つかったタグを処理します。これはネストされた Server Component に対応するためです。ただし、内部の `singlePass` 関数はすべてのタグを見つけてレンダーし、その後外側のループで結果を置き換えます。このため、同じタグが複数回処理される可能性があります（ただし、`result` が更新されるため、二回目以降はタグが見つからなくなるはずです）。しかし、タグのレンダー結果がまだマーカーコメントを含んでいる場合（たとえば、レンダー結果自身に `<!--zenith-server-component:...-->` が含まれていると）、次回のループでまた見つけてしまい、無限ループに近い動作になる可能性があります。現在の `MAX_PASSES=10` はこれを防ぐための保護ですが、理想的にはレンダー結果にマーカーが残らないようにするか、またはレンダー結果からマーカーを stripping するべきです。
- **提案の修正:** `renderServerComponent` が返す HTML にマーカー coment が含まれないことを保証する（すでにマーカーは外部で追加しているため、本関数では付加していないはずです）。ただし、ユーザーがカスタム компонェントを作成し、そこにマーカーに似た文字列を含めるケースを考えると、出力をサニタイズするか、またはマーカーのプレフィックスをよりユニークなものに変更することを検討してください。

---

## ۴. پیشنهادات ارتقا

### IMP-SSR-01: Enhance security documentation and logging
- **для чего:** レンダー時に注入される値がすべて適切にサニタイズされていることを明確にし、開発者の安心感を向上
- **実装:** `renderToString` と `renderToStream` の JSDoc に、state と route がどのようにエスケープされているかを詳細に記述し、さらに `ssrEnvironmentError` のメッセージをより具体的に改善してください。

### IMP-SSR-02: Add AbortSignal support for cancellation
- **дляそのために:** クライアント切断時などの不要なレンダーを防ぎ、リソース効率を向上
- **実装:** `renderToString` と `renderToStream` に `options.signal?: AbortSignal` を追加し、内部で定期的にチェックするか、`Promise.race` を使って早期終了を実装してください。

### IMP-SSR-03: Improve server-component registry HMR safety
- **дляそのために:** HMR シナリオでのメモリリークを防止
- **実装:** `registerServerComponent` 内で、上書きが発生する場合に警告を出す（`console.warn`）か、または HMR フックから `clearServerComponents` を呼びやすいエクスポート関数を提供してください。

### IMP-SSR-04: Consider using a real HTML parser for server-component detection
- **дляそのために:** ネストや属性値による誤検出リスクを減らし、将来の拡張性を向上
- **実装:** 軽量な HTML パーサ（例えば `linkedom`）を試験的に導入し、パフォーマンスへの影響をベンチマークしてください。問題なければ置き換えを検討してください。

### IMP-SSR-05: Add explicit cleanup for AsyncLocalStorage in error paths
- **для поэтомуに:** 安定性とリソースリーク防止
- **実装:** `renderToString` の `try/finally` ブロック内で、`domAls.run` コールバックが例外で抜けた場合でもストアがクリアされることを明示的に保証してください（ただし、現在でも `run` コールバックの終了時に自動クリアされますが、コメントで説明を追加すると良いでしょう）。

### IMP-SSR-06: Document limitations and assumptions
- **дляそのために:** ライブラリの利用範囲を明確にし、誤用を防止
- **実которы:** README または JSDoc に、このパッケージが Node.js 環境（jsdom が必要）専用であり、ブラウザーやエッジランタイムでの使用はサポート外であることを明記してください。

### IMP-SSR-07: Add type guards for internal store access
- **дляそのために:** TypeScript の安全性を向上し、ランタイムエラーを減らす
- **実装:** `domAls.getStore()` の結果をより厳密に型付けし、必要に応じてガード関数を追加してください。

### IMP-SSR-08: Provide a way to inspect current SSR context (for debugging)
- **дляそのために:** デバッグ体験を向上
- **実装:** デバッグ用に、現在の `domAls.getStore()` を取得するエクスポート関数（内部使用専用）を提供してください（ただし、本番では内部実装を晒さないよう注意）。

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **runtime** | `renderToString` と `renderToStream` は `Zen.start` と `Zen.stop` を呼び出し、`state` を渡します | ✅ 必須 |
| **scheduler** | `flushSync` を再エクスポートし、レンダー後の同期フラッシュに使用 | ✅ 必須 |
| **router** | `runWithRoute` をオプションで使用し、リクエストごとに `routeSignal` を分離 | ✅ 必要時 |
| **server-component** (self) | 自分自身ですが、内部で `defineServerComponent` などを提供 | ✅ 自明 |
| **state** | `signal` と関連 API を再エクスポートし、hydration で使用 | ✅ 必須 |
| **hydration** (self) | `hydrate` 関数をエクスポートし、クライアントサイドでのアドプトを行う | ✅ 必須 |
| **dom-context** (self) | DOM グローバルの分離を提供 | ✅ 自明 |
| **errors** | `ssrEnvironmentError` を使用して環境エラーを報告 | ✅ 必要時 |
| **types** | `@types/node` を DevDependency として使用 (JSDOM の型取得のため) | ✅ 開発時 |
| **jsdom** | PeerDependency として必要 (SSR の DOM シミュレーション) | ✅ 必須 |

---

## ۶. نتیجه‌گیری کلی

پکیج `ssr` زینیت فریم‌ورک का сервер‑сайд рендеринг 기능을 담당하며, AsyncLocalStorage 기반의 전역 상태 격리, 스트리밍 SSR, 서버 컴포넌트 지원, 그리고 hydration을 제공합니다. 이 패키지는 보안 진화(예: 스크립트 태그 탈출 방지)와 동시성 안전성(경쟁 조건 방지)에서 좋은 현재 상태를 보여줍니다.

이 패키지의 강점:
- AsyncLocalStorage를 사용한 완벽한 요청 범위 DOM 및 EffectContext 격리 (경쟁 조건 제거)
- 서버 컴포넌트 지원 (React와의 주요 차별점)
- 스트리밍 및 완전한 HTML 생성 옵션 제공
- 방어적 코딩 (XSS 방지 이스케이프, 경로 검증)
- 명확한 문서화와 주석 (특히 기능 및 버그 수정 주석)

주요 개선점:
- AbortSignal을 통한 취소 지원 추가
- 서버 컴포넌트 레지스트리의 HMR 안정성 향상
- 선택적 HTML 파서 도입으로 서버 컴포넌트 탐지 견고성 향상
- 보안 로깅 및 문서화 강화
- 에러 메시지와 환경 검사 개선
- 타이머 또는 타임아웃 메커니즘 검토 (장기 렌더링 방지)

**امتیاز کلی: 8/۱۰** (існує добре продуктована архитектура з місцем для покращень у безпекі та стабільності)

---
*گزارش توسط Claude Code - تاریخ: 2026-07-01*