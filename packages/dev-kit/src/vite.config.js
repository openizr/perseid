/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import fs from 'fs';
import path from 'path';
import {
  isInstalled,
  projectRootPath,
  getDevKitConfig,
  findProjectConfig,
  logConfigSources,
} from './helpers/project.js';
import { fileURLToPath } from 'url';
import autoprefixer from 'autoprefixer';
import { visualizer } from 'rollup-plugin-visualizer';
import postCssSortMediaQueries from 'postcss-sort-media-queries';
import { defineConfig as viteDefineConfig, mergeConfig, loadConfigFromFile } from 'vite';

const devKitConfig = getDevKitConfig();
const srcPath = path.join(projectRootPath, devKitConfig.srcPath);
const srcSubDirectories = fs.readdirSync(srcPath, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((directory) => directory.name);

/**
 * Adds the banner on top of every bundled file. Rolldown's `output.banner` is stripped by the
 * minifier and Vite prepends its own preamble in `generateBundle`, so files are patched on disk.
 */
const bannerPlugin = (banner) => ({
  name: 'dev-kit:banner',
  async writeBundle(options, bundle) {
    await Promise.all(Object.values(bundle).map(async (file) => {
      const isChunk = file.type === 'chunk';
      if (!isChunk && !(/\.css$/.test(file.fileName))) {
        return;
      }
      const filePath = path.join(options.dir, file.fileName);
      await fs.promises.writeFile(filePath, `${banner}\n${await fs.promises.readFile(filePath, 'utf-8')}`);
      // Keeps sourcemaps aligned by offsetting them by the banner's lines.
      if (isChunk && fs.existsSync(`${filePath}.map`)) {
        const map = JSON.parse(await fs.promises.readFile(`${filePath}.map`, 'utf-8'));
        map.mappings = `${';'.repeat(banner.split('\n').length)}${map.mappings}`;
        await fs.promises.writeFile(`${filePath}.map`, JSON.stringify(map));
      }
    }));
  },
});

const devKitViteConfig = viteDefineConfig(async () => {
  const env = process.env.ENV;
  const hasSvelte = isInstalled('svelte');
  const plugins = [];

  if (hasSvelte) {
    plugins.push((await import('@sveltejs/vite-plugin-svelte')).svelte({
      configFile: findProjectConfig('svelte') ?? fileURLToPath(new URL('./svelte.config.js', import.meta.url)),
    }));
  }
  if (isInstalled('vue')) {
    plugins.push((await import('@vitejs/plugin-vue')).default());
  }
  if (isInstalled('react')) {
    plugins.push((await import('@vitejs/plugin-react')).default());
  }
  if (env === 'production') {
    plugins.push(visualizer({ filename: path.join(projectRootPath, 'report.html') }));
    if (devKitConfig.banner !== undefined) {
      plugins.push(bannerPlugin(devKitConfig.banner));
    }
  }

  return {
    // Vitest must find the root `__mocks__` directory in the source directory.
    root: env === 'test' ? srcPath : projectRootPath,
    base: devKitConfig.publicPath ?? '/',
    cacheDir: path.join(projectRootPath, 'node_modules/.vite'),
    resolve: {
      // Absolute imports (e.g. `import 'styles/index.scss'`).
      alias: Object.fromEntries(srcSubDirectories.map((directory) => [directory, path.join(srcPath, directory)])),
      // Vitest resolves packages with node conditions: svelte would load its server build.
      ...(env === 'test' && hasSvelte) ? { conditions: ['browser', 'module', 'development|production'] } : {},
    },
    // Svelte testing library ships `.svelte` files, so it must go through the svelte plugin.
    ...(env === 'test' && hasSvelte) ? { ssr: { noExternal: [/@testing-library\/svelte/] } } : {},
    server: {
      host: devKitConfig.devServer?.host,
      port: process.env[devKitConfig.devServer?.port] ?? devKitConfig.devServer?.port,
    },
    css: {
      postcss: { plugins: [autoprefixer].concat(env === 'production' ? [postCssSortMediaQueries] : []) },
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
    define: Object.fromEntries(Object.entries(devKitConfig.env?.[env] ?? {}).map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)])),
    plugins,
  };
});

/**
 * Dev-kit defaults deep-merged with project overrides (object, or function of Vite's env).
 *
 * @param overrides Project-specific Vite/Vitest config.
 *
 * @returns Vite config.
 */
export function defineConfig(overrides = {}) {
  return viteDefineConfig(async (env) => mergeConfig(
    await devKitViteConfig(env),
    typeof overrides === 'function' ? await overrides(env) : overrides,
  ));
}

/**
 * Loads the config used by scripts: the project's `vite.config.*` when present, else the defaults.
 *
 * @param command Vite command.
 *
 * @param mode Vite mode.
 *
 * @returns Resolved inline config.
 */
export async function loadViteConfig(command, mode) {
  const env = { command, mode, isSsrBuild: false, isPreview: false };
  const projectConfig = findProjectConfig('vite');
  logConfigSources();
  const config = (projectConfig === undefined)
    ? await devKitViteConfig(env)
    : (await loadConfigFromFile(env, projectConfig, projectRootPath)).config;
  // Prevents Vite from loading the project's config file a second time.
  return { ...config, configFile: false };
}

export default devKitViteConfig;
