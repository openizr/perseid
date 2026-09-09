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
  projectRootPath,
  getDevKitConfig,
} from './project.js';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { pathToFileURL, fileURLToPath } from 'url';

const devKitConfig = getDevKitConfig();
const isStylesheet = (file) => /\.(css|scss|sass)$/.test(file);
const srcPath = path.join(projectRootPath, devKitConfig.srcPath);
const distPath = path.join(projectRootPath, devKitConfig.distPath);
export const assetExtensions = [
  'woff', 'woff2', 'eot', 'ttf', 'otf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'mp4',
  'webm', 'ogg', 'mp3', 'wav', 'flac', 'aac', 'txt',
];

/**
 * Source stylesheets are shipped as-is (see `writeDistFiles`): imports stay, pointing to their copy.
 * Bundles and copies both start at `distPath` root.
 */
const stylesheetsPlugin = {
  name: 'dev-kit:stylesheets',
  setup(build) {
    build.onResolve({ filter: /\.(css|scss|sass)$/ }, (args) => {
      const file = args.path.startsWith('.')
        ? path.resolve(args.resolveDir, args.path)
        : path.join(srcPath, args.path);

      if (!file.startsWith(`${srcPath}${path.sep}`) || !fs.existsSync(file)) {
        return undefined;
      }

      return { path: `./${path.relative(srcPath, file).split(path.sep).join('/')}`, external: true };
    });
  },
};

/**
 * Minimal esbuild plugin compiling Vue single file components with `vue/compiler-sfc`. Third-party
 * plugins either need `@vue/compiler-sfc` as a direct dependency (breaks pnpm) or corrupt CSS with
 * JS sourcemap comments.
 */
async function vuePlugin(production) {
  const {
    parse,
    compileScript,
    rewriteDefault,
    compileTemplate,
    compileStyleAsync,
  } = await import('vue/compiler-sfc');
  const descriptors = new Map();

  return {
    name: 'dev-kit:vue',
    setup(build) {
      // `<style>` blocks are exposed as virtual CSS files, bundled by esbuild.
      build.onResolve({ filter: /\.vue\?type=style/ }, (args) => ({
        path: args.path,
        namespace: 'vue-style',
      }));

      build.onLoad({ filter: /.*/, namespace: 'vue-style' }, async (args) => {
        const [filename, query] = args.path.split('?');
        const { descriptor, id } = descriptors.get(filename);
        const style = descriptor.styles[Number(new URLSearchParams(query).get('index'))];
        const { code, errors } = await compileStyleAsync({
          id: `data-v-${id}`,
          filename,
          source: style.content,
          scoped: style.scoped,
          preprocessLang: style.lang,
        });
        return {
          loader: 'css',
          contents: code,
          resolveDir: path.dirname(filename),
          errors: errors.map((error) => ({ text: error.message })),
        };
      });

      build.onLoad({ filter: /\.vue$/ }, async (args) => {
        const { descriptor, errors } = parse(await fs.promises.readFile(args.path, 'utf-8'), {
          filename: args.path,
        });

        if (errors.length > 0) {
          return { errors: errors.map((error) => ({ text: error.message })) };
        }

        const relativePath = path.relative(projectRootPath, args.path);
        const id = createHash('sha256').update(relativePath).digest('hex').slice(0, 8);
        descriptors.set(args.path, { descriptor, id });
        const scoped = descriptor.styles.some((style) => style.scoped);
        const isTs = [descriptor.script?.lang, descriptor.scriptSetup?.lang].includes('ts');
        const hasScript = descriptor.script !== null || descriptor.scriptSetup !== null;
        const script = hasScript
          ? compileScript(descriptor, { id, isProd: production, sourceMap: false })
          : null;
        let contents = hasScript
          ? rewriteDefault(script.content, '_sfc_main', isTs ? ['typescript'] : [])
          : 'const _sfc_main = {};';

        if (descriptor.template !== null) {
          const template = compileTemplate({
            id,
            scoped,
            isProd: production,
            filename: args.path,
            slotted: descriptor.slotted,
            source: descriptor.template.content,
            compilerOptions: { bindingMetadata: script?.bindings },
          });
          if (template.errors.length > 0) {
            return { errors: template.errors.map((error) => ({ text: String(error.message ?? error) })) };
          }
          contents += `\n${template.code.replace(/\nexport (function|const) render/, '\n$1 render')}\n_sfc_main.render = render;`;
        }
        descriptor.styles.forEach((_style, index) => {
          contents += `\nimport ${JSON.stringify(`${args.path}?type=style&index=${index}`)};`;
        });
        contents += scoped ? `\n_sfc_main.__scopeId = "data-v-${id}";` : '';
        contents += `\n_sfc_main.__file = ${JSON.stringify(path.basename(args.path))};\nexport default _sfc_main;`;
        return { contents, loader: isTs ? 'ts' : 'js', resolveDir: path.dirname(args.path) };
      });
    },
  };
}

/**
 * Svelte 5 compiles TypeScript natively: only `<style lang="scss|sass">` blocks need work.
 */
async function sveltePlugin(production) {
  const sass = await import('sass');
  return (await import('esbuild-svelte')).default({
    compilerOptions: { css: production ? 'external' : 'injected' },
    preprocess: {
      async style({ content, attributes, filename }) {
        if (!['scss', 'sass'].includes(attributes.lang)) {
          return undefined;
        }
        const result = await sass.compileStringAsync(content, {
          sourceMap: true,
          loadPaths: [srcPath],
          url: pathToFileURL(filename),
          syntax: attributes.lang === 'sass' ? 'indented' : 'scss',
        });
        const dependencies = result.loadedUrls.filter((url) => url.protocol === 'file:').map(fileURLToPath);
        return {
          code: result.css,
          map: result.sourceMap,
          dependencies: dependencies.filter((file) => file !== filename),
        };
      },
    },
  });
}

/**
 * esbuild options shared by `build` and `dev` for node/library targets.
 *
 * @param production Whether to build for production (minified, banner, metafile).
 *
 * @param plugins Extra esbuild plugins.
 *
 * @returns esbuild options.
 */
export async function getEsbuildOptions(production, plugins = []) {
  await fs.promises.rm(distPath, { recursive: true, force: true });
  return {
    entryPoints: Object.fromEntries(Object.entries(devKitConfig.entries).map(([name, entry]) => [
      name,
      path.join(srcPath, entry),
    ])),
    loader: Object.fromEntries(assetExtensions.map((extension) => [`.${extension}`, 'file'])),
    banner: (production && devKitConfig.banner !== undefined)
      ? { js: devKitConfig.banner, css: devKitConfig.banner }
      : undefined,
    bundle: true,
    target: 'es2022',
    format: 'esm',
    platform: 'node',
    outdir: distPath,
    sourcemap: true,
    minify: production,
    metafile: production,
    keepNames: production,
    splitting: devKitConfig.splitChunks !== false,
    external: Object.keys(packageJson.dependencies ?? {})
      .concat(Object.keys(packageJson.peerDependencies ?? {}))
      .concat(['*.scss', '*.css']),
    plugins: [stylesheetsPlugin]
      .concat(plugins)
      .concat(isInstalled('vue') ? [await vuePlugin(production)] : [])
      .concat(isInstalled('svelte') ? [await sveltePlugin(production)] : []),
  };
}

/**
 * Writes the distributable `package.json` (and README/LICENSE when present) into `distPath`, and
 * copies source stylesheets untouched, keeping their layout.
 * `devKitConfig.extraPackageJsonKeys` lists additional keys to copy over (e.g. `sideEffects`).
 *
 * @param version Package version to publish.
 */
export function writeDistFiles(version) {
  const keys = [
    'name',
    'main',
    'type',
    'types',
    'bugs',
    'author',
    'exports',
    'engines',
    'license',
    'keywords',
    'homepage',
    'repository',
    'sideEffects',
    'description',
    'contributors',
    'dependencies',
    'peerDependencies',
    'peerDependenciesMeta',
  ].concat(devKitConfig.extraPackageJsonKeys ?? []);
  const distPackageJson = { ...Object.fromEntries(keys.map((key) => [key, packageJson[key]])), version };
  fs.writeFileSync(path.join(distPath, 'package.json'), `${JSON.stringify(distPackageJson, null, 2)}\n`);
  ['README.md', 'LICENSE'].forEach((file) => {
    if (fs.existsSync(path.join(projectRootPath, file))) {
      fs.copyFileSync(path.join(projectRootPath, file), path.join(distPath, file));
    }
  });
  fs.readdirSync(srcPath, { recursive: true }).filter((file) => isStylesheet(file)).forEach((file) => {
    fs.mkdirSync(path.dirname(path.join(distPath, file)), { recursive: true });
    fs.copyFileSync(path.join(srcPath, file), path.join(distPath, file));
  });
}
