// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  processErrorBoundary,
  recoverFromError,
  reportError,
  clearError,
  errorSignal,
  getErrorHistory,
  onError,
} from '../src/index';

describe('@zenith/error-boundary DOM unit tests (#28)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearError();
  });

  it('captures errors inside boundary subtree, renders fallback template, and recovers', () => {
    const host = document.createElement('div');
    host.setAttribute('zen-error', '');
    host.innerHTML = `
      <p class="child">Normal Content</p>
      <template zen-fallback><div class="fallback-ui">Something went wrong</div></template>
    `;
    document.body.appendChild(host);

    const seenErrors: string[] = [];
    const unsub = onError((entry) => {
      if (entry) seenErrors.push(entry.message);
    });

    const disposes: Array<() => void> = [];
    const walkedChildren: HTMLElement[] = [];
    const cleanup = processErrorBoundary(
      host,
      (child) => {
        walkedChildren.push(child);
      },
      disposes,
    );

    expect(walkedChildren).toHaveLength(1);
    reportError(new Error('Render failed'), 'zen-text', { element: walkedChildren[0] });

    expect(errorSignal.get()?.message).toBe('Render failed');
    expect(host.querySelector('.fallback-ui')?.textContent).toBe('Something went wrong');
    expect(seenErrors).toContain('Render failed');
    expect(getErrorHistory().length).toBeGreaterThan(0);

    // Recover from error and restore original HTML
    recoverFromError(host);
    expect(errorSignal.get()).toBeNull();
    expect(host.querySelector('.child')?.textContent).toBe('Normal Content');

    unsub();
    cleanup();
  });
});
