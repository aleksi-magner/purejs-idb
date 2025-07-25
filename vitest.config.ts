import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

const metaURL: string = import.meta.url;

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['**/src/**/*.spec.{js,ts}'],
    root: fileURLToPath(new URL('./', metaURL)),
    cache: false,
    setupFiles: ['fake-indexeddb/auto'],
    isolate: true,
    passWithNoTests: true,
    bail: 1,
    logHeapUsage: false,
    watch: false,
    css: false,
    clearMocks: true,
    mockReset: true,
    restoreMocks: false, // true,
    reporters: 'default',
    coverage: {
      provider: 'v8',
      enabled: true,
      include: ['**/src/**'],
      exclude: ['**/**/*.d.ts'],
      clean: true,
      cleanOnRerun: true,
      skipFull: false,
      reportOnFailure: false,
      reportsDirectory: '__coverage__',
      all: true,
      reporter: ['text'],
      thresholds: {
        perFile: false,
      },
    },
  },
});
