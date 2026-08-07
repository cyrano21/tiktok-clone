/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native$': '<rootDir>/src/mocks/react-native-test.ts',
    '^react-native-reanimated$': '<rootDir>/src/mocks/react-native-reanimated.ts',
    '^react-native-safe-area-context$': '<rootDir>/src/mocks/react-native-safe-area-context.ts',
    '^react-native-gesture-handler$': '<rootDir>/src/mocks/react-native-gesture-handler.ts',
    '^react-native-video$': '<rootDir>/src/mocks/react-native-video.web.tsx',
  },
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/e2e/'],
  transformIgnorePatterns: ['<rootDir>/node_modules/(?!(react-native|react-native-web)/)'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json',
    }],
  },
};
