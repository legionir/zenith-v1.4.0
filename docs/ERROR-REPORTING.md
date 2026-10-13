# External Error Reporting Guide: Sentry & OpenTelemetry (`#93`)

`@zenith/error-boundary` provides `addReporter(reporter, options?) -> Cleanup` to forward structured framework errors (directives, expressions, scheduler effects, HTTP/resource failures) to external observability platforms such as **Sentry** and **OpenTelemetry** with built-in PII redaction and fault isolation.

---

## 1. Sentry Integration

```ts
import * as Sentry from '@sentry/browser';
import { addReporter } from '@zenith/error-boundary';
import { routeSignal } from '@zenith/router';

const stopReporting = addReporter(
  (report) => {
    Sentry.withScope((scope) => {
      scope.setTag('zenith.code', report.code);
      scope.setTag('zenith.category', report.category);
      if (report.source) scope.setTag('zenith.source', report.source);
      scope.setContext('zenith', report.context);
      Sentry.captureException(report.error);
    });
  },
  {
    redactPII: true,
    enrichContext: () => ({
      route: routeSignal.get().path,
      release: '1.5.0',
    }),
  },
);
```

---

## 2. OpenTelemetry Integration

```ts
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { addReporter } from '@zenith/error-boundary';

const tracer = trace.getTracer('zenith-ui');

const stopOtel = addReporter((report) => {
  const span = tracer.startSpan(`zenith.error.${report.code}`);
  span.recordException(report.error);
  span.setAttributes({
    'zenith.error.code': report.code,
    'zenith.error.category': report.category,
    'zenith.error.source': report.source ?? 'unknown',
  });
  span.setStatus({ code: SpanStatusCode.ERROR, message: report.message });
  span.end();
});
```

---

## 3. Built-in Guarantees

1. **Default PII Redaction (`redactPII: true`)**: Sensitive keys (`password`, `token`, `accessToken`, `refreshToken`, `secret`, `authorization`, `cookie`, `apiKey`, `ssn`, `creditCard`) and inline email addresses / `Bearer <token>` strings are automatically replaced with `'[REDACTED]'`.
2. **Fault Isolation**: If a reporter throws synchronously or rejects asynchronously, the error is caught and isolated so a broken telemetry endpoint never crashes your application.
3. **Cleanup Protocol (`#116`)**: `addReporter` returns an idempotent `Cleanup` function (`() => void`).
