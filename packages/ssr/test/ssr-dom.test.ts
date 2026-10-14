// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderToString,
  renderToStream,
  generateFullPage,
  defineServerComponent,
  registerServerComponent,
  clearServerComponents,
  calculateChecksum,
  validateHydrationChecksum,
  deserializeStateFromString,
} from '../src/index';

describe('@zenith/ssr DOM & streaming unit tests (#28)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearServerComponents();
  });

  it('renders HTML + state with ServerComponents, generates full page, and validates hydration checksum', async () => {
    const unregister = registerServerComponent(
      defineServerComponent('user-greeting', async (props) => {
        return `<div class="sc-greeting">Welcome, ${String(props.name ?? 'Guest')}!</div>`;
      }),
    );

    const result = await renderToString(
      `<div><h1 zen-text="$heading"></h1><zen-server-component name="user-greeting" prop:name="$userName"></zen-server-component></div>`,
      {
        heading: 'Server Title',
        userName: 'Aria',
      },
    );

    expect(result.html).toContain('Server Title');
    expect(result.html).toContain('Welcome, Aria!');
    expect(result.state).toContain('Server Title');

    const checksum = calculateChecksum(result.html);
    expect(typeof checksum).toBe('string');

    const clientRoot = document.createElement('div');
    clientRoot.innerHTML = result.html;
    expect(validateHydrationChecksum(result.html, clientRoot)).toBe(true);

    const page = generateFullPage(result, '<title>SSR Test Page</title>');
    expect(page).toContain('SSR Test Page');
    expect(page).toContain('Server Title');

    const hydrated = deserializeStateFromString(result.state);
    expect(hydrated).toMatchObject({ heading: 'Server Title', userName: 'Aria' });

    unregister();
  });

  it('streams chunks via renderToStream and respects options', async () => {
    const chunks: string[] = [];
    for await (const chunk of renderToStream(`<main><p zen-text="$label"></p></main>`, {
      label: 'Streamed Content',
    })) {
      chunks.push(chunk.html);
    }
    const joined = chunks.join('');
    expect(joined).toContain('Streamed Content');
    expect(joined).toContain('__ZENITH_STATE__');
  });
});
