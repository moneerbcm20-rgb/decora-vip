import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Ensure correct base path for Vercel deployment
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist', // Output directory for the build
  },
  resolve: {
    alias: {
// FIX: __dirname is not available in ES modules. path.resolve('./') correctly resolves to the project root.
      '@': path.resolve('./'),
    },
  },
});
