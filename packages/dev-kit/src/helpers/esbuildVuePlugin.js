/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

/**
 * Minimal esbuild plugin compiling Vue single file components with `vue/compiler-sfc`.
 * Third-party plugins either need `@vue/compiler-sfc` as a direct dependency (breaks pnpm strict
 * layouts) or corrupt CSS with JS sourcemap comments.
 *
 * @returns esbuild plugin.
 */
export default async function esbuildVuePlugin() {
  const {
    parse,
    compileScript,
    rewriteDefault,
    compileTemplate,
    compileStyleAsync,
  } = await import('vue/compiler-sfc');
  const isProd = process.env.ENV === 'production';
  const descriptors = new Map();

  return {
    name: 'dev-kit:vue',
    setup(build) {
      // `<style>` blocks are exposed as virtual CSS files, bundled by esbuild.
      build.onResolve({ filter: /\.vue\?type=style/ }, (args) => ({ path: args.path, namespace: 'vue-style' }));
      build.onLoad({ filter: /.*/, namespace: 'vue-style' }, async (args) => {
        const [filename, query] = args.path.split('?');
        const index = Number(new URLSearchParams(query).get('index'));
        const { descriptor, id } = descriptors.get(filename);
        const style = descriptor.styles[index];
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
        const source = await fs.promises.readFile(args.path, 'utf-8');
        const { descriptor, errors } = parse(source, { filename: args.path });
        if (errors.length > 0) {
          return { errors: errors.map((error) => ({ text: error.message })) };
        }
        const id = createHash('sha256').update(path.relative(process.cwd(), args.path)).digest('hex').slice(0, 8);
        descriptors.set(args.path, { descriptor, id });
        const hasScoped = descriptor.styles.some((style) => style.scoped);
        const isTs = [descriptor.script?.lang, descriptor.scriptSetup?.lang].includes('ts');
        let script = null;
        let contents = '';

        if (descriptor.script !== null || descriptor.scriptSetup !== null) {
          script = compileScript(descriptor, { id, isProd, sourceMap: false });
          contents += rewriteDefault(script.content, '_sfc_main', isTs ? ['typescript'] : []);
        } else {
          contents += 'const _sfc_main = {};';
        }

        if (descriptor.template !== null) {
          const template = compileTemplate({
            id,
            isProd,
            filename: args.path,
            scoped: hasScoped,
            slotted: descriptor.slotted,
            source: descriptor.template.content,
            compilerOptions: { bindingMetadata: script?.bindings },
          });
          if (template.errors.length > 0) {
            return { errors: template.errors.map((error) => ({ text: String(error.message ?? error) })) };
          }
          contents += `\n${template.code.replace(/\nexport (function|const) render/, '\n$1 render')}`;
          contents += '\n_sfc_main.render = render;';
        }

        descriptor.styles.forEach((_style, index) => {
          contents += `\nimport ${JSON.stringify(`${args.path}?type=style&index=${index}`)};`;
        });
        if (hasScoped) {
          contents += `\n_sfc_main.__scopeId = "data-v-${id}";`;
        }
        contents += `\n_sfc_main.__file = ${JSON.stringify(path.basename(args.path))};`;
        contents += '\nexport default _sfc_main;';

        return { contents, loader: isTs ? 'ts' : 'js', resolveDir: path.dirname(args.path) };
      });
    },
  };
}
