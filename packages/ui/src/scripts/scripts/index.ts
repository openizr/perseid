/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * Default number of columns in the grid.
 */
export const gridColumns = 12;

/**
 * Default breakpoints values.
 */
export const breakpoints = {
  xxs: '0px',
  xs: '376px',
  s: '576px',
  m: '768px',
  l: '992px',
  xl: '1200px',
};

/**
 * Default gaps values.
 */
export const gaps = {
  0: '0rem',
  1: '0.25rem',
  2: '0.5rem',
  3: '1rem',
  4: '2rem',
  5: '4rem',
  6: '8rem',
  7: '12rem',
};

/**
 * Default shorthands.
 */
export const shorthands = {
  grid: ['display', 'grid'],
  flex: ['display', 'flex'],
  none: ['display', 'none'],
  block: ['display', 'block'],
  inline: ['display', 'inline'],
  'inline-flex': ['display', 'inline-flex'],
  'inline-grid': ['display', 'inline-grid'],
  'flex-wrap': ['flex-wrap', 'wrap'],
  'flex-nowrap': ['flex-wrap', 'nowrap'],
  'flex-wrap-rev': ['flex-wrap', 'wrap-reverse'],
  'flex-row': ['flex-direction', 'row'],
  'flex-col': ['flex-direction', 'column'],
  'flex-col-rev': ['flex-direction', 'column-reverse'],
  'flex-row-rev': ['flex-direction', 'row-reverse'],
  'grid-row': ['grid-auto-flow', 'row'],
  'grid-col': ['grid-auto-flow', 'column'],
  'grid-dense': ['grid-auto-flow', 'dense'],
  'flex-none': ['flex', 'none'],
  'flex-auto': ['flex', '1 1 auto'],
  'justify-between': ['justify-content', 'space-between'],
  'justify-start': ['justify-content', 'flex-start'],
  'justify-end': ['justify-content', 'flex-end'],
  'justify-stretch': ['justify-content', 'stretch'],
  'justify-center': ['justify-content', 'center'],
  'items-center': ['align-items', 'center'],
  'items-start': ['align-items', 'flex-start'],
  'items-end': ['align-items', 'flex-end'],
  'items-stretch': ['align-items', 'stretch'],
  'self-center': ['align-self', 'center'],
  'self-start': ['align-self', 'flex-start'],
  'self-end': ['align-self', 'flex-end'],
  'self-stretch': ['align-self', 'stretch'],
  'text-left': ['text-align', 'left'],
  'text-right': ['text-align', 'right'],
  'text-center': ['text-align', 'center'],
  'text-justify': ['text-align', 'justify'],
  'w-full': ['width', '100%'],
  'h-full': ['height', '100%'],
};

/**
 * Generates Perseid SCSS variables from `configuration`.
 *
 * @param configuration Configuration from which to generate the SASS variables definitions.
 * Contains the grid columns, gaps, breakpoints and shorthands to use.
 *
 * @param isDefault Whether to add the `!default` flag to the variables. Defaults to `false`.
 *
 * @returns Generated SASS variables definitions.
 */
export function generateSassVariables(configuration: {
  gridColumns?: number;
  gaps?: Record<string, string>;
  breakpoints?: Record<string, string>;
  shorthands?: Record<string, string[]>;
}, isDefault = false): string {
  const columns = configuration.gridColumns ?? gridColumns;
  const gapKeys = Object.keys(configuration.gaps ?? gaps);
  const allShorthands = {
    ...shorthands,
    ...configuration.shorthands,
    ...(new Array(columns).fill(0)).reduce<Record<string, string[]>>((cols, _, index) => ({
      ...cols,
      [`col-${String(index + 1)}`]: [
        'grid-column',
        `span ${String(index + 1)}`,
      ],
    }), {}),
    ...(new Array(columns).fill(0)).reduce<Record<string, string[]>>((cols, _, index) => ({
      ...cols,
      [`cols-${String(index + 1)}`]: [
        'grid-template-columns',
        `repeat(${String(index + 1)}, minmax(0, 1fr))`,
      ],
    }), {}),
    ...gapKeys.reduce<Record<string, string[]>>((all, key) => ({
      ...all,
      [`vgap-${key}`]: [
        'row-gap',
        `var(--gap-${key})`,
      ],
    }), {}),
    ...gapKeys.reduce<Record<string, string[]>>((all, key) => ({
      ...all,
      [`hgap-${key}`]: [
        'column-gap',
        `var(--gap-${key})`,
      ],
    }), {}),
  };

  let generatedScssContent = '';
  generatedScssContent += '/**\n * Breakpoints used to generate media queries.\n */\n';
  generatedScssContent += `$perseid-breakpoints: (\n${Object.entries(configuration.breakpoints ?? breakpoints).map(([key, value]) => `  ${key}: ${value}`).join(',\n')}\n)${isDefault ? ' !default' : ''};`;
  generatedScssContent += '\n\n';
  generatedScssContent += '/**\n * Gaps used to generate the grid system.\n */\n';
  generatedScssContent += `$perseid-gaps: (\n${Object.entries(configuration.gaps ?? gaps).map(([key, value]) => `  ${key}: ${value}`).join(',\n')}\n)${isDefault ? ' !default' : ''};`;
  generatedScssContent += '\n\n';
  generatedScssContent += '//**************************************************************************************************\n';
  generatedScssContent += '// Built-in internal variables - DO NOT USE THEM DIRECTLY, USE THE `layout` MIXIN INSTEAD.\n';
  generatedScssContent += '//**************************************************************************************************';
  generatedScssContent += '\n\n';
  generatedScssContent += `$perseid-shorthands: (\n${Object.entries(allShorthands).map(([key, value]) => `  '${key}': (\n    'property': (\n      '${value[0]}',\n      '${value[1]}'\n    ),\n    'variants': (\n      '${key}',${Object.entries(configuration.breakpoints ?? breakpoints).map(([breakpointKey]) => `\n      '${breakpointKey}:${key}'`).join(',')}\n    )\n  )`).join(',\n')}\n)${isDefault ? ' !default' : ''};`;
  generatedScssContent += '\n';
  return generatedScssContent;
}

/**
 * Generates Perseid UI layout types definitions from `configuration`.
 *
 * @param configuration Configuration from which to generate the types definitions.
 * Contains the grid columns, gaps, breakpoints and shorthands to use.
 *
 * @returns Generated types definitions.
 */
export function generateTypeDefinitions(configuration: {
  gridColumns?: number;
  gaps?: Record<string, string>;
  breakpoints?: Record<string, string>;
  shorthands?: Record<string, string[]>;
}): string {
  const gapKeys = Object.keys(configuration.gaps ?? gaps);
  const allShorthands = {
    ...shorthands,
    ...configuration.shorthands,
    ...(new Array(gridColumns).fill(0)).reduce<Record<string, string[]>>((cols, _, index) => ({
      ...cols,
      [`col-${String(index + 1)}`]: [
        'grid-column',
        `span ${String(index + 1)}`,
      ],
    }), {}),
    ...(new Array(gridColumns).fill(0)).reduce<Record<string, string[]>>((cols, _, index) => ({
      ...cols,
      [`cols-${String(index + 1)}`]: [
        'grid-template-columns',
        `repeat(${String(index + 1)}, minmax(0, 1fr))`,
      ],
    }), {}),
    ...gapKeys.reduce<Record<string, string[]>>((all, key) => ({
      ...all,
      [`vgap-${key}`]: [
        'row-gap',
        `var(--gap-${key})`,
      ],
    }), {}),
    ...gapKeys.reduce<Record<string, string[]>>((all, key) => ({
      ...all,
      [`hgap-${key}`]: [
        'column-gap',
        `var(--gap-${key})`,
      ],
    }), {}),
  };

  let generatedTypeDefinitionsContent = '';
  generatedTypeDefinitionsContent += 'declare global {';
  generatedTypeDefinitionsContent += '\n';
  generatedTypeDefinitionsContent += '  /**\n   * Perseid built-in breakpoint.\n   */\n';
  generatedTypeDefinitionsContent += `  type Breakpoint = ${Object.keys(configuration.breakpoints ?? breakpoints).map((key) => `'${key}'`).join(' | ')};`;
  generatedTypeDefinitionsContent += '\n\n';
  generatedTypeDefinitionsContent += '  /**\n   * Perseid built-in shorthand.\n   */\n';
  generatedTypeDefinitionsContent += `  type Shorthand = (\n    ${Object.keys(allShorthands).map((key) => `'${key}'`).join('\n    | ')}\n  );`;
  generatedTypeDefinitionsContent += '\n\n';
  generatedTypeDefinitionsContent += '  /**\n   * Adds native autocomplete for `data-layout` attribute to all React elements.\n   */\n';
  generatedTypeDefinitionsContent += '  namespace React {';
  generatedTypeDefinitionsContent += '\n';
  generatedTypeDefinitionsContent += '    interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {';
  generatedTypeDefinitionsContent += '\n';
  generatedTypeDefinitionsContent += '      \'data-layout\'?: Shorthand | `${';
  generatedTypeDefinitionsContent += 'Breakpoint}:${';
  generatedTypeDefinitionsContent += 'Shorthand}` | (string & Record<never, never>);';
  generatedTypeDefinitionsContent += '\n';
  generatedTypeDefinitionsContent += '    }';
  generatedTypeDefinitionsContent += '\n';
  generatedTypeDefinitionsContent += '  }';
  generatedTypeDefinitionsContent += '\n';
  generatedTypeDefinitionsContent += '}';
  generatedTypeDefinitionsContent += '\n';

  return generatedTypeDefinitionsContent;
}
