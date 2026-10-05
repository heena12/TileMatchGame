module.exports = {
  root: true,
  ignorePatterns: ['vite.web.config.mts', 'dist-web/', 'coverage/'],
  extends: '@react-native',
  overrides: [
    {
      // Rules 2 and 3: the engine is pure TypeScript and cannot reach UI or platform code.
      files: ['src/engine/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  'react',
                  'react-*',
                  '@react-native*',
                  '@react-navigation*',
                  'zustand*',
                  '@ui/*',
                  '@state/*',
                  '@services/*',
                  '@app/*',
                  '@navigation/*',
                  '@config/*',
                  '**/ui/**',
                  '**/state/**',
                  '**/services/**',
                  '**/app/**',
                ],
                message: 'The Game Engine must stay pure TypeScript.',
              },
            ],
          },
        ],
      },
    },
  ],
};
