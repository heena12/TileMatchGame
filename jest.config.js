module.exports = {
  preset: '@react-native/jest-preset',
  testPathIgnorePatterns: [
    '/node_modules/',
    'storageContract',
    'helpers',
    'testUtils',
    'harness',
  ],
  collectCoverageFrom: ['src/engine/**/*.ts'],
  // GAME_DESIGN 13.7: engine line coverage >= 90%.
  coverageThreshold: {
    './src/engine/': {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@engine$': '<rootDir>/src/engine/index.ts',
    '^@engine/(.*)$': '<rootDir>/src/engine/$1',
    '^@ui/(.*)$': '<rootDir>/src/ui/$1',
    '^@state/(.*)$': '<rootDir>/src/state/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@app/(.*)$': '<rootDir>/src/app/$1',
    '^@navigation/(.*)$': '<rootDir>/src/navigation/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-mmkv|react-native-nitro-modules|react-native-screens|react-native-safe-area-context|react-native-gesture-handler|react-native-reanimated|react-native-worklets)/)',
  ],
};
