module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['.'],
        alias: {
          '@engine': './src/engine',
          '@ui': './src/ui',
          '@state': './src/state',
          '@services': './src/services',
          '@app': './src/app',
          '@navigation': './src/navigation',
          '@config': './src/config',
        },
      },
    ],
    // Must be last.
    'react-native-worklets/plugin',
  ],
};
