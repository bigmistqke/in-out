import devtools from 'solid-devtools/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate', devOptions: {
        enabled: true
      }
    }), devtools(), solidPlugin()],
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
});
