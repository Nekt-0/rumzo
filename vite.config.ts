import { defineConfig } from 'vite';
import { sites } from '@openai/sites-vite-plugin';

export default defineConfig({
  plugins: [sites()],
  resolve: { conditions: ['worker', 'browser'] },
  ssr: { noExternal: true },
  build: {
    ssr: 'src/site-worker.ts',
    outDir: 'dist/server',
    emptyOutDir: true,
    target: 'es2022',
    minify: true,
    rollupOptions: { output: { entryFileNames: 'index.js' } }
  }
});
