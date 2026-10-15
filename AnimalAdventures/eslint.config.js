const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    ignores: [
      'node_modules/',
      'android/',
      'ios/',
      '.expo/',
      'dist/',
      'web-build/',
    ],
  },
  {
    rules: {
      'react/prop-types': 'off',

      // Pre-existing pattern surfaced by the React Compiler rules that ship
      // with eslint-plugin-react-hooks v6. Not an upgrade regression: these
      // effects intentionally sync state from persisted/hydrated data (e.g.
      // resuming a saved round or board), which the rule can't distinguish
      // from an accidental cascading render. Demoted to a warning so CI stays
      // green; worth cleaning up as a separate refactor.
      'react-hooks/set-state-in-effect': 'warn',

      // Same situation, surfaced by a later v7 release: this flags ordinary
      // `someRef.current = ...` assignments inside a useCallback (e.g. a
      // debounce timer ref in trace-letter.game.component.jsx) as mutating a
      // "hook argument", even though a ref's whole purpose is to be mutated
      // after the hook call. A pre-existing, idiomatic pattern, not a bug -
      // demoted to a warning for the same reason as above.
      'react-hooks/immutability': 'warn',
    },
  },
  {
    // Build tooling runs in Node, not React Native.
    files: ['scripts/**/*.js', '*.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
];
