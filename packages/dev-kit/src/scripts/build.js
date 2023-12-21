/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import '../config/env.js';
import path from 'path';
import fs from 'fs-extra';
import { build } from 'vite';
import esbuild from 'esbuild';
import colors from 'picocolors';
import { fileURLToPath } from 'url';
import viteConfig from '../config/vite.config.js';
import checkFiles from '../helpers/checkFiles.js';

const { log, error } = console;
const projectRootPath = path.resolve(path.dirname(fileURLToPath(new URL(import.meta.url))), '../../../../');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRootPath, 'package.json')));
const readmePath = path.join(projectRootPath, 'README.md');
const licensePath = path.join(projectRootPath, 'LICENSE');
const { devKitConfig } = packageJson;
const srcPath = path.join(projectRootPath, devKitConfig.srcPath);
const distPath = path.join(projectRootPath, devKitConfig.distPath);

/**
 * Runs `build` CLI command's script.
 */
async function run() {
  process.stdout.write('\x1Bc');
  const force = process.argv.includes('--force');

  // Checking files...
  if (!force) {
    log(colors.magenta(colors.bold('Checking files...\n')));
    await checkFiles(projectRootPath, packageJson, srcPath, false);
  }

  log(colors.magenta(colors.bold('Building...\n')));
  try {
    if (devKitConfig.target === 'web') {
      // Front-end projects: we use Vite as a bundler.
      const publicAssetsPath = path.join(distPath, 'assets');
      const publicIndexHtmlPath = path.join(distPath, 'index.html');
      await fs.copy(path.resolve(srcPath, devKitConfig.html), path.join(projectRootPath, 'index.html'));
      await fs.remove(publicIndexHtmlPath);
      await fs.remove(publicAssetsPath);
      await build(await viteConfig());
      await fs.remove(distPath);
      await fs.remove(path.join(projectRootPath, 'index.html'));
      await fs.rename(path.join(projectRootPath, '__dist__'), distPath);
    } else {
      // Back-end/NPM package projects: we directly use esbuild.

      let vuePlugin = null;
      try {
        await import('vue');
        vuePlugin = (await import('esbuild-plugin-vue-next')).default;
      } catch (e) {
        // No-op.
      }

      let sveltePlugin = null;
      try {
        await import('svelte');
        const sveltePreprocess = (await import('svelte-preprocess')).default;
        sveltePlugin = (await import('esbuild-svelte')).default({
          compilerOptions: { css: 'external' },
          preprocess: sveltePreprocess(),
        });
      } catch (e) {
        // No-op.
      }

      let startTimestamp = 0;
      await fs.remove(distPath);
      startTimestamp = Date.now();
      const result = await esbuild.build({
        entryPoints: Object.keys(devKitConfig.entries).reduce((entrypoints, entrypoint) => ({
          ...entrypoints,
          [entrypoint]: path.join(srcPath, devKitConfig.entries[entrypoint]),
        }), {}),
        loader: ['woff', 'woff2', 'eot', 'ttf', 'otf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'mp4', 'webm', 'ogg', 'mp3', 'wav', 'flac', 'aac', 'scss', 'txt'].reduce((extensions, extension) => ({
          ...extensions, [`.${extension}`]: 'file',
        }), {}),
        banner: (devKitConfig.banner === undefined) ? undefined : {
          js: devKitConfig.banner,
          css: devKitConfig.banner,
        },
        bundle: true,
        target: 'es6',
        minify: true,
        format: 'esm',
        platform: 'node',
        outdir: distPath,
        metafile: true,
        splitting: devKitConfig.splitChunks !== false,
        external: Object.keys(packageJson.dependencies ?? {})
          .concat(Object.keys(packageJson.peerDependencies ?? {})),
        sourcemap: true,
        plugins: []
          .concat(vuePlugin !== null ? [vuePlugin()] : [])
          .concat(sveltePlugin !== null ? [sveltePlugin] : []),
      });
      const analysis = await esbuild.analyzeMetafile(result.metafile);
      log(analysis);
      // Writing distributable `package.json` file into `dist` directory...
      await fs.writeJson(path.join(distPath, 'package.json'), {
        name: packageJson.name,
        main: packageJson.main,
        type: packageJson.type,
        types: packageJson.types,
        bugs: packageJson.bugs,
        author: packageJson.author,
        version: packageJson.version,
        engines: packageJson.engines,
        license: packageJson.license,
        keywords: packageJson.keywords,
        homepage: packageJson.homepage,
        repository: packageJson.repository,
        description: packageJson.description,
        contributors: packageJson.contributors,
        dependencies: packageJson.dependencies,
        peerDependencies: packageJson.peerDependencies,
        peerDependenciesMeta: packageJson.peerDependenciesMeta,
      }, { spaces: 2 });
      // Writing distributable `README.md` file into `dist` directory...
      const readmeExists = await fs.pathExists(readmePath);
      if (readmeExists) {
        await fs.copy(readmePath, path.resolve(distPath, 'README.md'));
      }
      // Writing distributable `LICENSE` file into `dist` directory...
      const licenseExists = await fs.pathExists(licensePath);
      if (licenseExists) {
        await fs.copy(licensePath, path.resolve(distPath, 'LICENSE'));
      }
      log(colors.green(`${colors.bold('\n[esbuild]: ')}Successfully built in ${Date.now() - startTimestamp}ms (${result.errors.length} errors, ${result.warnings.length} warnings).\n`));
    }
  } catch (e) {
    error(colors.red(colors.bold('\n✖ Build failed.\n')));
    process.exit(1);
  }
}

run();
