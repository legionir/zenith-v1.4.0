import { defineConfig } from 'vite';
import { zenithPlugin } from '@zenith/vite-plugin';

export default defineConfig({
  plugins: [
    zenithPlugin(),
  ],
  server: {
    port: 3000,
  },
});
