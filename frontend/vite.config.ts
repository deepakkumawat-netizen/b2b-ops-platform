import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // @b2b-ops/shared is an npm-workspace symlink resolving to
  // packages/shared/dist (CommonJS output). Without this, Vite/Rollup
  // resolves the symlink to its real path outside node_modules, so
  // @rollup/plugin-commonjs's default include (/node_modules/) never
  // matches it and named exports fail to resolve at build time (works fine
  // in dev via esbuild's more permissive CJS interop, breaks only in
  // `vite build`). Keeping the node_modules path unresolved fixes it.
  resolve: {
    preserveSymlinks: true,
  },
  build: {
    // The New School page's chunk (~530 kB, ~120 kB gzipped) is the phone
    // input's number metadata + bundled flag icons + the country list —
    // lazy-loaded with that route only. The big world state/city lists are
    // served by /api/geo instead. Warn if anything grows past this.
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
