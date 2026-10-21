import { defineConfig } from 'vite';
import { zenithPlugin } from '@zenith/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins: [zenithPlugin(), VitePWA({ strategies: 'injectManifest', srcDir: 'public', filename: 'sw.js', injectRegister: false, manifest: false, injectManifest: { injectionPoint: undefined } })],
  server: { host: '0.0.0.0', port: 3000 }, build: { target: 'es2022' },
});
