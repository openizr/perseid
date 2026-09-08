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
import { projectRootPath, packageJson, isInstalled } from '../helpers/paths.js';

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

/**
 * Adds the banner on top of every bundled file. Rolldown's `output.banner` is stripped by the
 * minifier and Vite prepends its own preamble in `generateBundle`, so files are patched on disk.
 */
const bannerPlugin = (banner) => ({
  name: 'dev-kit:banner',
  async writeBundle(options, bundle) {
    const bannerLines = banner.split('\n').length;
    await Promise.all(Object.values(bundle).map(async (file) => {
      const isChunk = file.type === 'chunk';
      if (!isChunk && !(/\.css$/.test(file.fileName))) {
        return;
      }
      const filePath = path.join(options.dir, file.fileName);
      await fs.promises.writeFile(filePath, `${banner}\n${await fs.promises.readFile(filePath, 'utf-8')}`);
      // Keeps sourcemaps aligned by offsetting them by the banner's lines.
      const mapPath = `${filePath}.map`;
      if (isChunk && fs.existsSync(mapPath)) {
        const map = JSON.parse(await fs.promises.readFile(mapPath, 'utf-8'));
        map.mappings = `${';'.repeat(bannerLines)}${map.mappings}`;
        await fs.promises.writeFile(mapPath, JSON.stringify(map));
      }
    }));
  },
});

export default defineConfig(async () => {
  const plugins = [];
  const hasSvelte = isInstalled('svelte');

  if (hasSvelte) {
    plugins.push((await import('@sveltejs/vite-plugin-svelte')).svelte({
      configFile: path.join(path.dirname(fileURLToPath(new URL(import.meta.url))), './svelte.config.js'),
    }));
  }

  if (isInstalled('vue')) {
    plugins.push((await import('@vitejs/plugin-vue')).default());
  }

  if (isInstalled('react')) {
    plugins.push((await import('@vitejs/plugin-react')).default());
  }

  if (process.env.ENV === 'production' && devKitConfig.banner !== undefined) {
    plugins.push(bannerPlugin(devKitConfig.banner));
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
    cacheDir: path.join(projectRootPath, 'node_modules/.vite'),
    resolve: {
      // Allows absolute imports resolution (e.g. `import 'styles/index.scss'`).
      alias: srcSubDirectories.reduce((aliases, directory) => ({
        ...aliases, [directory]: path.join(srcPath, directory),
      }), {}),
      // Vitest resolves packages with node conditions: svelte would load its server build.
      ...(process.env.ENV === 'test' && hasSvelte) ? { conditions: ['browser', 'module', 'development|production'] } : {},
    },
    // Svelte testing library ships `.svelte` files, so it must go through the svelte plugin.
    ...(process.env.ENV === 'test' && hasSvelte) ? { ssr: { noExternal: [/@testing-library\/svelte/] } } : {},
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
      target: 'es2015',
      outDir: '__dist__',
      sourcemap: true,
      chunkSizeWarningLimit: 250,
      rolldownOptions: {
        output: {
          format: (devKitConfig.splitChunks === false) ? 'iife' : 'esm',
          ...(devKitConfig.splitChunks === false) ? { codeSplitting: false } : {},
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
      coverage: {
        // Uncovered files must be listed explicitly since vitest 4.
        include: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,vue,svelte}'],
        exclude: ['**/__mocks__/**', '**/__tests__/**', '**/*.d.ts'],
        reporter: ['text', 'lcov'],
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
