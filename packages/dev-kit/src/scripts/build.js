/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  resolveBin,
  packageJson,
  projectRootPath,
  getDevKitConfig,
} from '../helpers/project.js';
import fs from 'fs';
import path from 'path';
import { build } from 'vite';
import esbuild from 'esbuild';
import colors from 'picocolors';
import { spawnSync } from 'child_process';
import checkFiles from '../helpers/checkFiles.js';
import { loadViteConfig } from '../vite.config.js';
import { getEsbuildOptions, writeDistFiles } from '../helpers/esbuild.js';

const { log, error } = console;
const devKitConfig = getDevKitConfig();
const srcPath = path.join(projectRootPath, devKitConfig.srcPath);
const distPath = path.join(projectRootPath, devKitConfig.distPath);
const tsConfigPath = path.join(projectRootPath, 'tsconfig.json');

/** Recursively lists `.d.ts` files under `directory`. */
const listTypings = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const entryPath = path.join(directory, entry.name);
  return entry.isDirectory() ? listTypings(entryPath) : [entryPath].filter((file) => file.endsWith('.d.ts'));
});

/**
 * Emits declaration files into `distPath`, laid out like esbuild's outputs (entries' directory as
 * root). Absolute imports (`scripts/...`) are rewritten to relative ones and assets imports dropped,
 * as consumers cannot resolve them.
 */
function generateTypings() {
  log(colors.magenta(colors.bold('Generating typings...\n')));
  // Tests and mocks are left out of the program (their inferred types point at test tooling).
  const typingsConfigPath = path.join(projectRootPath, 'tsconfig.typings.json');
  fs.writeFileSync(typingsConfigPath, JSON.stringify({
    extends: './tsconfig.json',
    exclude: ['**/__tests__/**', '**/__mocks__/**', '**/*.test.*', '**/*.spec.*'],
    compilerOptions: {
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      rootDir: devKitConfig.srcPath,
      outDir: devKitConfig.distPath,
    },
  }));

  const tsc = spawnSync(process.execPath, [
    resolveBin('typescript-native', 'tsc'),
    '--project', typingsConfigPath,
  ], { stdio: 'inherit' });

  fs.rmSync(typingsConfigPath);

  if (tsc.status !== 0) {
    throw new Error('Typings generation failed.');
  }

  // Entries' common directory (esbuild's `outbase`), flattened into `distPath`.
  const entries = Object.values(devKitConfig.entries ?? {}).map((entry) => (
    path.relative(srcPath, path.dirname(path.resolve(srcPath, entry)))
  ));

  const entriesDirectory = entries.reduce((common, directory) => {
    let candidate = directory;
    while (candidate !== '' && candidate !== common && !common.startsWith(`${candidate}/`)) {
      candidate = path.dirname(candidate).replace('.', '');
    }
    return candidate;
  }, entries[0] ?? '');

  const outputPath = (srcRelativePath) => path.join(distPath, srcRelativePath.startsWith(`${entriesDirectory}/`)
    ? srcRelativePath.slice(entriesDirectory.length + 1)
    : srcRelativePath);

  if (entriesDirectory !== '' && fs.existsSync(path.join(distPath, entriesDirectory))) {
    fs.cpSync(path.join(distPath, entriesDirectory), distPath, { recursive: true });
    fs.rmSync(path.join(distPath, entriesDirectory.split('/')[0]), { recursive: true });
  }

  const aliases = fs.readdirSync(srcPath, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  listTypings(distPath).forEach((file) => {
    const source = fs.readFileSync(file, 'utf-8');
    const rewritten = source
      .replace(/^import\s+['"][^'"]+\.(css|scss|sass|less|svg|png|jpe?g|gif|webp|woff2?|eot|ttf|otf|mp[34]|webm|ogg|wav|flac|aac|txt|json)['"];?\n/gm, '')
      .replace(/((?:from|import)\s*\(?\s*)(['"])([^'"]+)\2/g, (match, prefix, quote, specifier) => {
        if (!aliases.some((name) => specifier === name || specifier.startsWith(`${name}/`))) {
          return match;
        }
        const relative = path.relative(path.dirname(file), outputPath(specifier)).replace(/\\/g, '/');
        return `${prefix}${quote}${relative.startsWith('.') ? relative : `./${relative}`}${quote}`;
      });
    if (rewritten !== source) {
      fs.writeFileSync(file, rewritten);
    }
  });
}

/**
 * Runs `build` CLI command's script.
 */
async function run() {
  process.env.ENV = 'production';
  process.env.NODE_ENV = 'production';
  process.stdout.write('\x1Bc');
  if (!process.argv.includes('--force')) {
    await checkFiles(false, false);
  }
  log(colors.magenta(colors.bold('Building...\n')));
  try {
    if (devKitConfig.target === 'web') {
      // Front-end projects: Vite bundles from a root `index.html`.
      const indexHtmlPath = path.join(projectRootPath, 'index.html');
      const buildPath = path.join(projectRootPath, '__dist__');
      await fs.promises.copyFile(path.resolve(srcPath, devKitConfig.html), indexHtmlPath);
      try {
        await build(await loadViteConfig('build', 'production'));
        await fs.promises.rm(distPath, { recursive: true, force: true });
        await fs.promises.rename(buildPath, distPath);
      } finally {
        await fs.promises.rm(indexHtmlPath, { force: true });
        await fs.promises.rm(buildPath, { recursive: true, force: true });
      }
    } else {
      // Back-end/NPM package projects: esbuild.
      const startTimestamp = Date.now();
      const result = await esbuild.build(await getEsbuildOptions(true));
      log(await esbuild.analyzeMetafile(result.metafile));
      writeDistFiles(packageJson.version);
      log(colors.green(`${colors.bold('\n[esbuild]: ')}Successfully built in ${Date.now() - startTimestamp}ms (${result.errors.length} errors, ${result.warnings.length} warnings).\n`));
    }
    if (devKitConfig.generateTypings === true && fs.existsSync(tsConfigPath)) {
      generateTypings();
    }
  } catch (e) {
    error(colors.red(colors.bold('\n✖ Build failed.\n')));
    // Vite wraps bundling errors into a `BundleError`.
    (e.errors ?? [e]).forEach((err) => error(colors.red(err.message ?? err)));
    process.exit(1);
  }
}

run();
