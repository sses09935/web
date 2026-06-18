/** @type {import('jest').Config} */
const config = {
  testMatch: ['<rootDir>/tests/unit/**/*.test.ts', '<rootDir>/tests/unit/**/*.test.tsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        module: 'esnext',
        moduleResolution: 'bundler',
        esModuleInterop: true,
        paths: {
          '@/*': ['./src/*']
        }
      }
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  modulePathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/out/', '<rootDir>/web/'],
  watchPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/out/', '<rootDir>/web/'],
  testEnvironment: 'jsdom',
};

module.exports = config;
