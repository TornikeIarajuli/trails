/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Runs after the preset's own setup files. Sheets use gesture-handler, whose native module needs this mock.
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@tanstack/.*|zustand)',
  ],
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
};
