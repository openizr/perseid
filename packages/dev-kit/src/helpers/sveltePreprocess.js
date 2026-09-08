/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

/**
 * Svelte preprocessor for esbuild builds. Svelte 5 compiles TypeScript natively, so only
 * `<style lang="scss|sass">` blocks need work.
 *
 * @param srcPath Absolute path to the project's source directory (extra Sass load path).
 *
 * @returns Svelte preprocessor group.
 */
export default function sveltePreprocess(srcPath) {
  return {
    name: 'dev-kit:sass',
    async style({ content, attributes, filename }) {
      if (attributes.lang !== 'scss' && attributes.lang !== 'sass') {
        return undefined;
      }
      const sass = await import('sass');
      const result = await sass.compileStringAsync(content, {
        sourceMap: true,
        loadPaths: [srcPath],
        url: pathToFileURL(filename),
        syntax: attributes.lang === 'sass' ? 'indented' : 'scss',
      });
      return {
        code: result.css,
        map: result.sourceMap,
        dependencies: result.loadedUrls
          .filter((url) => url.protocol === 'file:')
          .map((url) => fileURLToPath(url))
          .filter((file) => file !== filename)
          .map((file) => path.resolve(file)),
      };
    },
  };
}
