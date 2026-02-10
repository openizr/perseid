# ESLint 9 Configuration with Airbnb Rules

This is a complete ESLint 9 configuration that includes all rules from the popular `eslint-config-airbnb` package in the new flat config format.

## Features

- Uses ESLint 9's new flat config format (`eslint.config.js`)
- Includes all rules from:
  - Best practices
  - ES6
  - Import
  - Style
  - React
  - React-A11y
  - React Hooks

## Installation

1. Install ESLint 9 and required dependencies:

```bash
npm install --save-dev eslint globals
```

2. If you're using React rules, install the React plugin:

```bash
npm install --save-dev eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y
```

3. If you're using import rules, install the import plugin:

```bash
npm install --save-dev eslint-plugin-import
```

4. Copy the `eslint.config.js` file to your project's root directory

## Usage

ESLint 9 will automatically use the `eslint.config.js` file when you run ESLint. You can run ESLint with the following command:

```bash
npx eslint .
```

Or add a script to your `package.json` file:

```json
{
  "scripts": {
    "lint": "eslint ."
  }
}
```

## Customizing the Configuration

### Modifying Rules

You can add, remove, or modify rules by editing the `rules` object in the `eslint.config.js` file:

```js
// Example: Turn off a rule
rules: {
  'no-console': 'off',
  // other rules...
}
```

### Adding Additional Configuration Objects

You can add additional configuration objects to the exported array. This is useful for configuring different rules for different file patterns:

```js
export default [
  // Base configuration (already included)
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,tsx}'],
    // ...existing configuration
  },

  // Additional configuration for test files
  {
    files: ['**/*.test.{js,jsx,ts,tsx}', '**/__tests__/**'],
    rules: {
      'no-console': 'off',
      'react/prop-types': 'off',
      // other test-specific rules...
    }
  }
];
```

## Migrating from ESLint 8 or Earlier

If you're migrating from ESLint 8 or earlier, be aware that ESLint 9 has several breaking changes:

1. Node.js v18.18.0 or later is required
2. Some formatters have been removed and turned into separate packages
3. The `require-jsdoc` and `valid-jsdoc` rules have been removed
4. The `eslint:recommended` ruleset has been updated

For more details, refer to the [ESLint 9 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0).

## License

MIT