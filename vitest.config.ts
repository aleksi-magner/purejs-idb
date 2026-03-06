import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

const metaURL: string = import.meta.url;

export default defineConfig({
  test: {
    root: fileURLToPath(new URL('./', metaURL)),
    dir: './src',
    include: ['*.spec.{js,ts}'],
    setupFiles: ['fake-indexeddb/auto'],
    environment: 'happy-dom',
    cache: false,
    isolate: true,
    passWithNoTests: true,
    bail: 1,
    logHeapUsage: false,
    watch: false,
    css: false,
    clearMocks: true,
    mockReset: true,
    restoreMocks: false,
    reporters: 'default',
    coverage: {
      provider: 'v8',
      enabled: true,
      clean: true,
      cleanOnRerun: true,
      skipFull: false,
      reportOnFailure: false,
      reportsDirectory: '__coverage__',
      reporter: ['text'],
      thresholds: {
        perFile: false,
      },
    },
  },
});
