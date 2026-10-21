import { createCloudflareHandler } from '../../src';
import { createApp } from '@zenith/runtime-core';
import { headPlugin } from '@zenith/head';
export default createCloudflareHandler({
  template: '<main id="app"><h1 zen-text="name"></h1><div zen-html="markup"></div></main>',
  csp: { nonce: true },
  async state(route) { await Promise.resolve(); return { name: route, markup: '<img src=x onerror="attack()"><b>safe</b>' }; },
  head: route => ({ title: route }),
  app(context) { return createApp({ state: context.state, plugins: [headPlugin({ document: context.document })] }); },
});
