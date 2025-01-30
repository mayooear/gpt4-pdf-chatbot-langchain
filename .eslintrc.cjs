/* .eslintrc.cjs */

module.exports = {
  root: true, // Ensures ESLint doesn't look beyond this folder for configuration
  parser: '@typescript-eslint/parser', // Tells ESLint to parse TypeScript
  parserOptions: {
    ecmaVersion: 'latest', // Enables modern JavaScript features
    sourceType: 'module', // Allows import/export statements,
    project: './tsconfig.json', // Tells ESLint to use the tsconfig.json file
  },
  extends: [
    'eslint:recommended', // Basic ESLint rules
    'plugin:@typescript-eslint/recommended', // Adds TypeScript-specific rules
    'prettier', // Disables rules conflicting with Prettier
  ],
  ignorePatterns: [
    '.eslintrc.cjs',
    'scripts',
    'src/utils/lodash/*',
    'node_modules',
    'dist',
    'dist-cjs',
    '*.js',
    '*.cjs',
    '*.d.ts',
  ],
  rules: {
    // You can add or override any rules here, for example:
    // "no-console": "warn", // Warn when using console.log
  },
};
