import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // TypeScript strict rules - no escape hatches
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Complexity limits
      'max-lines': [
        'error',
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
      'max-depth': ['error', 3],
      complexity: ['error', 12],

      // Ban generic folder imports
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*/utils/*', '*/utils'],
              message: 'No utils folders. Use domain-specific names.',
            },
            {
              group: ['*/helpers/*', '*/helpers'],
              message: 'No helpers folders. Use domain-specific names.',
            },
            {
              group: ['*/common/*', '*/common'],
              message: 'No common folders. Use domain-specific names.',
            },
            {
              group: ['*/shared/*', '*/shared'],
              message: 'No shared folders. Use domain-specific names.',
            },
            {
              group: ['*/core/*', '*/core'],
              message: 'No core folders. Use domain-specific names.',
            },
          ],
        },
      ],

      // General quality
      'no-console': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.js'],
  },
];
