=== اسکن عمیق نهایی (.ts) ===

- eval() usage: cli/check.ts, cli/index.ts, expressions/evaluator.ts, expressions/validator.ts
- innerHTML assignments (XSS): compiler, components/async-loader, components/processor, crud/crud-engine, error-boundary/directive, permission/directive, router/outlet, runtime/hydrate, runtime/directives/html-trusted, runtime/directives/html, security/sanitizer, stateful/auth-view, stateful/resource-view, suspense/suspense, vscode-extension/extension
- setInterval بدون clearInterval: expressions/validator.ts
- حلقه‌های while(true) خطرناک: expressions/parser.ts:329,460,497
- listener leaks: cli/templates (15>0), compiler (1>0), devtools/hook (2>0), service-worker/sw (6>0), vite-plugin/compile (2>0), runtime/date-picker (3>0), vscode-extension/extension (1>0)
