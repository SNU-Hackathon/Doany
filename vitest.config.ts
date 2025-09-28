import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['node_modules', 'dist', '.expo'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'react-native': resolve(__dirname, './src/utils/test/mockReactNative.ts'),
    },
  },
  define: {
    global: 'globalThis',
  },
});
