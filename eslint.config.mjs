// https://docs.expo.dev/guides/using-eslint/
// https://typescript-eslint.io/getting-started/typed-linting
import expoConfig from 'eslint-config-expo/flat.js';
import { defineConfig } from 'eslint/config';
import sonarjs from 'eslint-plugin-sonarjs';
import { configs as tseslintConfigs } from 'typescript-eslint';

export default defineConfig([
  expoConfig,
  sonarjs.configs.recommended,
  {
    // Type-aware rules, at typescript-eslint's strictest presets, for every
    // TypeScript file. They read the same tsconfig as `tsc`.
    files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
    extends: [tseslintConfigs.strictTypeChecked, tseslintConfigs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // With `verbatimModuleSyntax`, a type must be imported as one.
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      // A `switch` over a union names every member, so a new one cannot slip past.
      '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true }],
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      // Numbers print the same in every engine (`${cents}¢`); booleans,
      // nullish values and objects still may not be interpolated.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // `onPress={() => setOpen(true)}` returns nothing anyone reads.
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
    },
  },
  {
    // The DSP kernels index typed arrays inside loops whose bounds are the
    // arrays' own lengths. A `?? 0` there would add a branch per sample on the
    // audio thread; the assertion costs nothing and says what the loop proves.
    files: ['src/audio/fft.ts', 'src/audio/mpm.ts', 'src/audio/decimate.ts', 'src/audio/flux.ts',
      'src/audio/chordSynth.ts', 'src/audio/sources/types.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    // react-native-svg deprecates `x`/`y` as transform shorthands, and its
    // types pin that on `<Rect>` and `<Text>` too, where they are the SVG
    // attributes themselves. Its allow-list cannot single them out.
    files: ['src/components/chords/ChordDiagram.tsx'],
    rules: { '@typescript-eslint/no-deprecated': 'off' },
  },
  {
    ignores: ['dist/*', '.expo/*', '.claude/*', 'android/*', 'ios/*', 'graft/*', 'releases/*'],
  },
]);
