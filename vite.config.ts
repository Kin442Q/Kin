/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Сайт отдаётся с корня своего домена (tahlilgar.cyou, GitHub Pages), поэтому base = '/'.
// Если вернуть адрес вида https://kin442q.github.io/Kin/, здесь нужен base = '/Kin/'.
const base = '/'

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: { app: path.resolve(__dirname, 'index.html'), landing: path.resolve(__dirname, 'landing/index.html') },
    },
  },
  server: {
    port: 5173,
    // Не открываем браузер автоматически во время e2e (Playwright сам управляет).
    open: !process.env.PW_TEST,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Frontend тесты только в src/. Backend тесты прогоняются через Jest отдельно.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/', 'server/', 'dist/', 'build/'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**'],
      exclude: ['node_modules/', 'src/test/', '**/*.config.*'],
    },
  },
})
