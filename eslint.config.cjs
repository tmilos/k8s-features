const pluginJs = require('@eslint/js');
const pluginJest = require('eslint-plugin-jest');
const pluginNode = require('eslint-plugin-node');

module.exports = [
  {
    // update this to match your test files
    files: ['**/*.spec.cjs', '**/*.test.cjs'],
    plugins: { jest: pluginJest },
    languageOptions: {
      globals: {
        ...pluginJest.environments.globals.globals,
        ...pluginNode.configs['recommended-script'].globals,
        setTimeout: "readonly",
      },
    },
    rules: {
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/prefer-to-have-length': 'warn',
      'jest/valid-expect': 'error',
    },
  },
  {
    files: ['**/*.cjs'],
    plugins: { js: pluginJs, node: pluginNode },
    languageOptions: {
      globals: {
        ...pluginJest.environments.globals.globals,
        ...pluginNode.configs['recommended-script'].globals,
        setTimeout: "readonly",
      },
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
    },
  },
];
