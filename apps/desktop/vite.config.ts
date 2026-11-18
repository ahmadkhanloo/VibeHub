import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { join, resolve } from 'node:path';

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@catalog': resolve(__dirname, '../../packages/catalog/src/index.ts'),
      '@': resolve(__dirname, 'src'),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: 'ws', host, port: 1421 }
      : undefined,
    // Leading-dot temp dirs are written and removed by the Tailwind plugin while it
    // resolves CSS imports; watching them crashes the dev server on Windows with EBUSY
    // when a stylesheet is saved at the same moment.
    watch: { ignored: ['**/src-tauri/**', '**/*.tmpdir/**', '**/.*.tmpdir/**'] },
  },
  build: {
    target: 'chrome110',
    sourcemap: false,
  },
}));
