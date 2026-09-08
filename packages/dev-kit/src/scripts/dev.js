/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  packageJson,
  isInstalled,
  resolvePackage,
  projectRootPath,
} from '../helpers/paths.js';
import path from 'path';
import fs from 'fs';
import esbuild from 'esbuild';
import colors from 'picocolors';
import { spawn } from 'child_process';
import viteConfig from '../config/vite.config.js';
import { send, createServer, createLogger } from 'vite';

const vitePackageJson = JSON.parse(fs.readFileSync(path.join(resolvePackage('vite'), 'package.json')));

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
      const config = await viteConfig();
      // Replaces Vite's built-in indexHtml middleware to provide a wider catch-all routing logic,
      // and serve a pre-processed `index.html` located wherever we want. `configureServer` post
      // hooks run right before Vite's html middlewares, which is the supported way to do it.
      config.plugins.push({
        name: 'dev-kit:index-html',
        configureServer(server) {
          return () => server.middlewares.use(async (request, response, next) => {
            if (response.writableEnded || request.method !== 'GET') {
              return next();
            }
            try {
              const indexHtmlPath = path.join(srcPath, devKitConfig.html);
              let html = await fs.promises.readFile(indexHtmlPath, 'utf-8');
              html = await server.transformIndexHtml(request.url, html, request.originalUrl);
              return send(request, response, html, 'html', { headers: server.config.server.headers });
            } catch (e) {
              return next(e);
            }
          });
        },
      });
      const server = await createServer(config);

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
            fs.writeFileSync(path.join(distPath, 'package.json'), `${JSON.stringify({
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
            }, null, 2)}\n`);

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

    await fs.promises.rm(distPath, { recursive: true, force: true });

    let vuePlugin = null;
    if (isInstalled('vue')) {
      vuePlugin = await (await import('../helpers/esbuildVuePlugin.js')).default();
    }

    let sveltePlugin = null;
    if (isInstalled('svelte')) {
      const sveltePreprocess = (await import('../helpers/sveltePreprocess.js')).default;
      sveltePlugin = (await import('esbuild-svelte')).default({
        compilerOptions: { css: 'injected' },
        preprocess: sveltePreprocess(srcPath),
      });
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
        .concat(vuePlugin !== null ? [vuePlugin] : [])
        .concat(sveltePlugin !== null ? [sveltePlugin] : []),
    });

    await context.watch();
  }
}

run();
