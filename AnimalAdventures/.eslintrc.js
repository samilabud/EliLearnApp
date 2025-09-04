module.exports = {
  root: true,
  env: {
    es6: true,
    es2021: true,
    node: true,
    jest: true,
    'react-native/react-native': true,
  },
  extends: [
    '@react-native-community',
    'plugin:react/recommended',
    'plugin:react-native/all',
    'prettier',
  ],
  parser: '@babel/eslint-parser',
  parserOptions: {
    requireConfigFile: false,
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['react', 'react-native', 'prettier'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  overrides: [
    {
      files: ['**/*.{js,jsx}'],
      parser: '@babel/eslint-parser',
      parserOptions: {
        requireConfigFile: false,
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
  ],
  rules: {
    'prettier/prettier': 'off',
    'react/prop-types': 'off',
  },
  ignorePatterns: [
    'node_modules/',
    'android/',
    'ios/',
    '.expo/',
    'dist/',
    'web-build/',
    '*.config.js',
    'metro.config.js',
    'babel.config.js',
  ],
};
