/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import autoprefixer from 'autoprefixer';
import { visualizer } from 'rollup-plugin-visualizer';
import validateConfig from '../helpers/validateConfig.js';
import postCssSortMediaQueries from 'postcss-sort-media-queries';

const projectRootPath = path.resolve(path.dirname(fileURLToPath(new URL(import.meta.url))), '../../../../');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRootPath, 'package.json')));
const { devKitConfig } = packageJson;
const srcPath = path.join(projectRootPath, devKitConfig.srcPath);

const srcSubDirectories = fs.readdirSync(srcPath, { withFileTypes: true })
  .filter((fileOrDirectory) => fileOrDirectory.isDirectory())
  .map((directory) => directory.name);

try {
  validateConfig(devKitConfig);
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
}

export default defineConfig(async () => {
  const plugins = [];

  try {
    await import('svelte');
    plugins.push((await import('@sveltejs/vite-plugin-svelte')).svelte({
      experimental: { useVitePreprocess: true },
      configFile: path.join(path.dirname(fileURLToPath(new URL(import.meta.url))), './svelte.config.js'),
    }));
  } catch (e) {
    // No-op.
  }

  try {
    await import('vue');
    plugins.push((await import('@vitejs/plugin-vue')).default());
  } catch (e) {
    // No-op.
  }

  try {
    await import('react');
    plugins.push((await import('@vitejs/plugin-react')).default());
  } catch (e) {
    // No-op.
  }

  if (process.env.ENV === 'production') {
    plugins.push(visualizer({
      filename: path.join(projectRootPath, 'report.html'),
    }));
  }

  return ({
    // This switch is necessary to make vitest find root `__mocks__` directory in source directory.
    root: process.env.ENV === 'test' ? srcPath : projectRootPath,
    base: devKitConfig.publicPath ?? '/',
    resolve: {
      // Allows absolute imports resolution (e.g. `import 'styles/index.scss'`).
      alias: srcSubDirectories.reduce((aliases, directory) => ({
        ...aliases, [directory]: path.join(srcPath, directory),
      }), {}),
    },
    server: {
      host: devKitConfig.devServer?.host,
      port: process.env[devKitConfig.devServer?.port] ?? devKitConfig.devServer?.port,
    },
    css: {
      postcss: {
        plugins: [autoprefixer].concat((process.env.ENV === 'production') ? [postCssSortMediaQueries] : []),
      },
    },
    build: {
      target: 'es6',
      outDir: '__dist__',
      sourcemap: true,
      chunkSizeWarningLimit: 250,
      rollupOptions: {
        output: {
          banner: devKitConfig.banner,
          format: (devKitConfig.splitChunks === false) ? 'iife' : 'esm',
          inlineDynamicImports: devKitConfig.splitChunks === false,
          assetFileNames: 'assets/[ext]/[name].[hash][extname]',
          entryFileNames: 'assets/js/[name].[hash].js',
          chunkFileNames: 'assets/js/[name].[hash].js',
        },
      },
    },
    test: {
      globals: true,
      passWithNoTests: true,
      include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      cache: { dir: path.join(projectRootPath, 'node_modules/.vitest') },
      coverage: {
        all: true,
        src: srcPath,
        allowExternal: true,
        reporter: ['text', 'lcov'],
        exclude: ['**/__mocks__', '**/__tests__', '**/*.d.ts'],
        reportsDirectory: path.join(projectRootPath, 'coverage'),
      },
    },
    // Statically replaces environment variables in JS code.
    define: Object.keys(devKitConfig.env?.[process.env.ENV] ?? {}).reduce((envVars, key) => (
      Object.assign(envVars, { [`process.env.${key}`]: JSON.stringify(devKitConfig.env[process.env.ENV][key]) })
    ), {}),
    plugins,
  });
});
