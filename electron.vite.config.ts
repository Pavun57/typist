import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          settings: resolve(import.meta.dirname, 'src/renderer/settings/index.html'),
          overlay: resolve(import.meta.dirname, 'src/renderer/overlay/index.html'),
          recorder: resolve(import.meta.dirname, 'src/renderer/recorder/index.html'),
        },
      },
    },
  },
});
