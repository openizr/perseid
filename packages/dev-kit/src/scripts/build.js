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
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { loadViteConfig } from '../vite.config.js';
import { getEsbuildOptions, writeDistFiles, assetExtensions } from '../helpers/esbuild.js';

const { log, error } = console;
const devKitConfig = getDevKitConfig();
const srcPath = path.join(projectRootPath, devKitConfig.srcPath);
const distPath = path.join(projectRootPath, devKitConfig.distPath);
const tsConfigPath = path.join(projectRootPath, 'tsconfig.json');

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

  // Entries' deepest common directory (esbuild's implicit `outbase`), flattened into `distPath`.
  const entriesDirectories = Object.values(devKitConfig.entries ?? {}).map((entry) => (
    path.relative(srcPath, path.dirname(path.resolve(srcPath, entry))).split(path.sep).filter(Boolean)
  ));
  const [first = []] = entriesDirectories;
  const divergence = first.findIndex((segment, index) => entriesDirectories.some((directory) => directory[index] !== segment));
  const entriesDirectory = first.slice(0, divergence === -1 ? first.length : divergence).join('/');

  const outputPath = (srcRelativePath) => path.join(distPath, srcRelativePath.startsWith(`${entriesDirectory}/`)
    ? srcRelativePath.slice(entriesDirectory.length + 1)
    : srcRelativePath);

  if (entriesDirectory !== '' && fs.existsSync(path.join(distPath, entriesDirectory))) {
    fs.cpSync(path.join(distPath, entriesDirectory), distPath, { recursive: true });
    fs.rmSync(path.join(distPath, entriesDirectory), { recursive: true });
    // Empty parents left behind.
    let parent = path.dirname(path.join(distPath, entriesDirectory));
    while (parent !== distPath && fs.readdirSync(parent).length === 0) {
      fs.rmSync(parent, { recursive: true });
      parent = path.dirname(parent);
    }
  }

  const aliases = fs.readdirSync(srcPath, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const assetImport = new RegExp(`^import\\s+['"][^'"]+\\.(${assetExtensions.concat('css', 'scss', 'sass', 'less', 'json').join('|')})['"];?\\n`, 'gm');
  fs.readdirSync(distPath, { recursive: true }).filter((file) => file.endsWith('.d.ts')).forEach((relativePath) => {
    const file = path.join(distPath, relativePath);
    const source = fs.readFileSync(file, 'utf-8');
    const rewritten = source
      .replace(assetImport, '')
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

process.env.ENV = 'production';
process.env.NODE_ENV = 'production';
process.stdout.write('\x1Bc');

if (!process.argv.includes('--force')) {
  const check = spawnSync(process.execPath, [fileURLToPath(new URL('./check.js', import.meta.url))], { stdio: 'inherit' });
  if (check.status !== 0) process.exit(1);
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
  (e.errors ?? [e]).forEach((err) => error(colors.red(err.message ?? err.text ?? err)));
  process.exit(1);
}
