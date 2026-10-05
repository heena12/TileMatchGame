import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => path.resolve(dirname, 'src', p);

/** Browser build of the app (react-native-web). Native builds do not use this file. */
export default defineConfig({
  root: path.resolve(dirname, 'web'),
  plugins: [react()],
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    global: 'globalThis',
  },
  resolve: {
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.web.js',
      '.tsx',
      '.ts',
      '.js',
      '.json',
    ],
    alias: [
      { find: /^react-native$/, replacement: 'react-native-web' },
      { find: /^@engine$/, replacement: src('engine/index.ts') },
      { find: /^@engine\//, replacement: src('engine') + '/' },
      { find: /^@ui\//, replacement: src('ui') + '/' },
      { find: /^@state\//, replacement: src('state') + '/' },
      { find: /^@services\//, replacement: src('services') + '/' },
      { find: /^@app\//, replacement: src('app') + '/' },
      { find: /^@navigation\//, replacement: src('navigation') + '/' },
      { find: /^@config\//, replacement: src('config') + '/' },
    ],
  },
  optimizeDeps: {
    // Prefer *.web.js so packages use their browser variants, not native specs.
    rolldownOptions: {
      resolve: { extensions: ['.web.js', '.web.ts', '.js', '.ts', '.json'] },
    },
  },
  server: { port: 5173, open: false },
  build: { outDir: path.resolve(dirname, 'dist-web'), emptyOutDir: true },
});
