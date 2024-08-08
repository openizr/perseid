/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import path from 'path';
import fs from 'fs-extra';
import esbuild from 'esbuild';
import colors from 'picocolors';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import viteConfig from '../config/vite.config.js';
import { send, createServer, createLogger } from 'vite';

const projectRootPath = path.resolve(path.dirname(fileURLToPath(new URL(import.meta.url))), '../../../../');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRootPath, 'package.json')));
const vitePackageJson = JSON.parse(fs.readFileSync(path.join(projectRootPath, 'node_modules/vite/package.json')));

let nodeProcess = null;
const { log, error } = console;
const { devKitConfig } = packageJson;
const srcPath = path.join(projectRootPath, devKitConfig.srcPath);
const distPath = path.join(projectRootPath, devKitConfig.distPath);
const random = () => Math.floor(Math.random() * 10);

/**
 * Runs `dev` CLI command's script.
 */
async function run() {
  if (devKitConfig.target === 'web') {
    // Front-end projects: we use Vite as a dev server.
    // We manually create the dev server as we want to get control over its built-in
    // middlewares (404 and indexHtml).
    try {
      const server = await createServer(await viteConfig());

      // We replace Vite's built-in indexHtml middleware to provide a wider catch-all routing logic,
      // and serve a pre-processed `index.html` located wherever we want.
      server.middlewares.stack.splice(server.middlewares.stack.length - 3, 1, {
        route: '',
        handle: async function customViteIndexHtmlMiddleware(request, response, next) {
          if (response.writableEnded) {
            return next();
          }

          try {
            // IF WE EVER NEED IT: special markup syntax regexp is
            // /<__TDK_PRODUCTION__>((?!__TDK_PRODUCTION__)(\n|.)*?)<\/__TDK_PRODUCTION__>/m
            // p1.trim().replace(/\n\s+/g, '');
            const indexHtmlPath = path.join(srcPath, devKitConfig.html);
            let html = await fs.readFile(indexHtmlPath, 'utf-8');
            html = await server.transformIndexHtml(request.url, html, request.originalUrl);
            return send(request, response, html, 'html', { headers: server.config.server.headers });
          } catch (e) {
            return next(e);
          }
        },
      });

      if (!server.httpServer) {
        throw new Error('HTTP server not available');
      }

      await server.listen();

      const { info } = server.config.logger;

      info(
        colors.cyan(`\n  vite v${vitePackageJson.version}`)
        + colors.green(' dev server running at:\n'),
        { clear: !server.config.logger.hasWarned },
      );

      server.printUrls();
      info('');

      if (global.__vite_start_time) { // eslint-disable-line no-underscore-dangle
        // eslint-disable-next-line no-underscore-dangle
        const startupDuration = performance.now() - global.__vite_start_time;
        info(`\n  ${colors.cyan(`ready in ${Math.ceil(startupDuration)}ms.`)}\n`);
      }
    } catch (e) {
      createLogger(viteConfig.logLevel).error(
        colors.red(`error when starting dev server:\n${e.stack}`),
        { error: e },
      );
      process.exit(1);
    }
  } else {
    // Back-end/NPM package projects: we directly use esbuild in watch mode.
    let startTimestamp = 0;
    const devKitPlugin = {
      name: 'devKit',
      setup(build) {
        build.onStart(() => {
          process.stdout.write('\x1Bc');
          // Used to display build time.
          startTimestamp = Date.now();
        });
        build.onEnd((result) => {
          if (result.errors.length === 0) {
            log(colors.green(`${colors.bold('[esbuild]: ')}Successfully built in ${Date.now() - startTimestamp}ms (${result.errors.length} errors, ${result.warnings.length} warnings).\n`));
            // Writing distributable `package.json` file into `dist` directory...
            fs.writeJsonSync(path.join(distPath, 'package.json'), {
              name: packageJson.name,
              main: packageJson.main,
              types: packageJson.types,
              type: packageJson.type,
              bugs: packageJson.bugs,
              author: packageJson.author,
              exports: packageJson.exports,
              // This trick forces invalidating NPM cache and allows real-time package testing.
              version: [random(), random(), random()].join('.'),
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

            // Executing main entrypoint if necessary (this is especially useful when developing
            // a NodeJS server for instance)...
            if (devKitConfig.runInDev === true) {
              if (nodeProcess !== null) {
                nodeProcess.kill('SIGKILL');
                nodeProcess = null;
              }
              nodeProcess = spawn('node', ['--enable-source-maps', path.join(distPath, packageJson.main)]);
              nodeProcess.stdout.on('data', (data) => {
                log(`${data.toString()}\n`);
              });
              nodeProcess.stderr.on('data', (data) => {
                error(colors.red(colors.bold('✖ Error occurred in main entry:\n')));
                error(`${data.toString().trim()}\n`);
              });
              nodeProcess.on('error', (...args) => {
                error(colors.red(colors.bold('✖ Could not run main entry:\n')));
                error(args[0]);
                error('');
              });
            }
          }
        });
      },
    };

    await fs.remove(distPath);

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
        compilerOptions: { css: 'injected' },
        preprocess: sveltePreprocess(),
      });
    } catch (e) {
      // No-op.
    }

    startTimestamp = Date.now();
    const context = await esbuild.context({
      entryPoints: Object.keys(devKitConfig.entries).reduce((entrypoints, entrypoint) => ({
        ...entrypoints,
        [entrypoint]: path.join(srcPath, devKitConfig.entries[entrypoint]),
      }), {}),
      loader: ['woff', 'woff2', 'eot', 'ttf', 'otf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'mp4', 'webm', 'ogg', 'mp3', 'wav', 'flac', 'aac', 'scss', 'txt'].reduce((extensions, extension) => ({
        ...extensions, [`.${extension}`]: 'file',
      }), {}),
      bundle: true,
      target: 'es6',
      format: 'esm',
      minify: false,
      platform: 'node',
      outdir: distPath,
      sourcemap: true,
      splitting: devKitConfig.splitChunks !== false,
      external: Object.keys(packageJson.dependencies ?? {})
        .concat(Object.keys(packageJson.peerDependencies ?? {})),
      plugins: [devKitPlugin]
        .concat(vuePlugin !== null ? [vuePlugin()] : [])
        .concat(sveltePlugin !== null ? [sveltePlugin] : []),
    });

    await context.watch();
  }
}

run();
