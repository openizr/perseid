/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import '../config/env.js';
import path from 'path';
import fs from 'fs';
import { build } from 'vite';
import esbuild from 'esbuild';
import colors from 'picocolors';
import viteConfig from '../config/vite.config.js';
import checkFiles from '../helpers/checkFiles.js';
import { projectRootPath, packageJson, isInstalled } from '../helpers/paths.js';

const { log, error } = console;
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
      await fs.promises.copyFile(path.resolve(srcPath, devKitConfig.html), path.join(projectRootPath, 'index.html'));
      await fs.promises.rm(publicIndexHtmlPath, { force: true });
      await fs.promises.rm(publicAssetsPath, { recursive: true, force: true });
      await build(await viteConfig());
      await fs.promises.rm(distPath, { recursive: true, force: true });
      await fs.promises.rm(path.join(projectRootPath, 'index.html'), { force: true });
      await fs.promises.rename(path.join(projectRootPath, '__dist__'), distPath);
    } else {
      // Back-end/NPM package projects: we directly use esbuild.

      let vuePlugin = null;
      if (isInstalled('vue')) {
        vuePlugin = await (await import('../helpers/esbuildVuePlugin.js')).default();
      }

      let sveltePlugin = null;
      if (isInstalled('svelte')) {
        const sveltePreprocess = (await import('../helpers/sveltePreprocess.js')).default;
        sveltePlugin = (await import('esbuild-svelte')).default({
          compilerOptions: { css: 'external' },
          preprocess: sveltePreprocess(srcPath),
        });
      }

      let startTimestamp = 0;
      await fs.promises.rm(distPath, { recursive: true, force: true });
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
        keepNames: true,
        splitting: devKitConfig.splitChunks !== false,
        external: Object.keys(packageJson.dependencies ?? {})
          .concat(Object.keys(packageJson.peerDependencies ?? {})),
        sourcemap: true,
        plugins: []
          .concat(vuePlugin !== null ? [vuePlugin] : [])
          .concat(sveltePlugin !== null ? [sveltePlugin] : []),
      });
      const analysis = await esbuild.analyzeMetafile(result.metafile);
      log(analysis);
      // Writing distributable `package.json` file into `dist` directory...
      await fs.promises.writeFile(path.join(distPath, 'package.json'), `${JSON.stringify({
        name: packageJson.name,
        main: packageJson.main,
        type: packageJson.type,
        types: packageJson.types,
        bugs: packageJson.bugs,
        author: packageJson.author,
        exports: packageJson.exports,
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
      }, null, 2)}\n`);
      // Writing distributable `README.md` file into `dist` directory...
      if (fs.existsSync(readmePath)) {
        await fs.promises.copyFile(readmePath, path.resolve(distPath, 'README.md'));
      }
      // Writing distributable `LICENSE` file into `dist` directory...
      if (fs.existsSync(licensePath)) {
        await fs.promises.copyFile(licensePath, path.resolve(distPath, 'LICENSE'));
      }
      log(colors.green(`${colors.bold('\n[esbuild]: ')}Successfully built in ${Date.now() - startTimestamp}ms (${result.errors.length} errors, ${result.warnings.length} warnings).\n`));
    }
  } catch (e) {
    error(colors.red(colors.bold('\n✖ Build failed.\n')));
    // Vite 8 wraps bundling errors into a `BundleError`.
    (e.errors ?? [e]).forEach((err) => error(colors.red(err.message ?? err)));
    process.exit(1);
  }
}

run();
