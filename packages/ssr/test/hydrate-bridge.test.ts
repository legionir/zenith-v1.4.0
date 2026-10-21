// @vitest-environment jsdom
import { expect, it, afterEach } from 'vitest';
import { hydrate, startFromSSR } from '../src';
import { resetDeprecationWarnings } from '@zenith/errors';
import { setHostPrinter } from '@zenith/errors/internal';

afterEach(() => { resetDeprecationWarnings(); });

it('#56 legacy ssr hydrate bridge warns once (ZEN-DEPR-108) and keeps its result shape', async () => {
  const messages: string[] = [];
  const release = setHostPrinter((_severity, title) => messages.push(title));
  try {
    const root = document.createElement('main');
    const first = await hydrate(root);
    expect(first.success).toBe(false);
    expect(first.error).toContain('__ZENITH_STATE__');
    const second = await hydrate(root, () => {});
    expect(second.success).toBe(false);
    expect(second.elementsAdopted).toBe(0);
    // startFromSSR delegates to the same bridge: one shared once-only warning.
    const viaAlias = await startFromSSR(root);
    expect(viaAlias).toEqual(second);
    expect(messages.filter((message) => message.includes('ZEN-DEPR-108'))).toHaveLength(1);
    expect(messages[0]).toContain('hydrate(root, init?) (@zenith/runtime-core)');
  } finally {
    release();
  }
});
