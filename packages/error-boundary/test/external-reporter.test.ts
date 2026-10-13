// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  addReporter,
  reportError,
  clearErrorBoundary,
  type ExternalErrorReport,
} from '../src';

describe('@zenith/error-boundary — external reporters & PII redaction (#93)', () => {
  beforeEach(() => {
    clearErrorBoundary();
  });

  it('forwards directive/expression errors with code, source, and enriched context', () => {
    const reports: ExternalErrorReport[] = [];
    const cleanup = addReporter(
      (r) => {
        reports.push(r);
      },
      {
        enrichContext: () => ({
          route: '/checkout',
          release: '1.5.0',
        }),
      },
    );

    const el = document.createElement('div');
    reportError(new Error('Expression failed'), 'zen-text', {
      expression: '$cart.total',
      element: el,
    });

    expect(reports).toHaveLength(1);
    const first = reports[0]!;
    expect(first.code).toBe('ZEN-905');
    expect(first.source).toBe('zen-text');
    expect(first.expression).toBe('$cart.total');
    expect(first.context.route).toBe('/checkout');
    expect(first.context.release).toBe('1.5.0');

    // Cleanup is idempotent and unsubscribes reporter
    cleanup();
    cleanup();
    reportError(new Error('After cleanup'), 'zen-if');
    expect(reports).toHaveLength(1);
  });

  it('redacts sensitive PII keys, emails, and Bearer tokens by default', () => {
    const reports: ExternalErrorReport[] = [];
    const cleanup = addReporter(
      (r) => {
        reports.push(r);
      },
      {
        redactKeys: ['nationalId'],
        enrichContext: {
          password: 'super-secret-password',
          accessToken: 'jwt-secret-token',
          authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.secret',
          nationalId: '0012345678',
          contact: 'user@example.com',
          safeField: 'kept-intact',
        },
      },
    );

    reportError(
      new Error('Auth failed for user@example.com with Bearer abcdef123456'),
      'auth',
    );

    expect(reports).toHaveLength(1);
    const report = reports[0]!;
    expect(report.message).toContain('[REDACTED_EMAIL]');
    expect(report.message).toContain('Bearer [REDACTED]');
    expect(report.message).not.toContain('user@example.com');
    expect(report.context.password).toBe('[REDACTED]');
    expect(report.context.accessToken).toBe('[REDACTED]');
    expect(report.context.authorization).toBe('[REDACTED]');
    expect(report.context.nationalId).toBe('[REDACTED]');
    expect(report.context.contact).toBe('[REDACTED_EMAIL]');
    expect(report.context.safeField).toBe('kept-intact');

    cleanup();
  });

  it('isolates synchronous and asynchronous reporter failures so they never break the app', async () => {
    const healthyReports: ExternalErrorReport[] = [];
    const cleanupBrokenSync = addReporter(() => {
      throw new Error('Sentry SDK crashed synchronously');
    });
    const cleanupBrokenAsync = addReporter(async () => {
      throw new Error('OpenTelemetry exporter rejected');
    });
    const cleanupHealthy = addReporter((r) => {
      healthyReports.push(r);
    });

    expect(() => {
      reportError(new Error('Recoverable directive error'), 'zen-bind');
    }).not.toThrow();

    expect(healthyReports).toHaveLength(1);
    expect(healthyReports[0]!.source).toBe('zen-bind');

    cleanupBrokenSync();
    cleanupBrokenAsync();
    cleanupHealthy();
  });

  it('documents Sentry and OpenTelemetry integration in docs/ERROR-REPORTING.md', () => {
    const docPath = join(process.cwd(), 'docs/ERROR-REPORTING.md');
    expect(existsSync(docPath)).toBe(true);
    const content = readFileSync(docPath, 'utf8');
    expect(content).toContain('Sentry');
    expect(content).toContain('OpenTelemetry');
    expect(content).toContain('addReporter');
  });
});
