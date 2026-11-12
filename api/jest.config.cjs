module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/*.unit.spec.ts'],
  reporters: ['default', 'jest-junit'],
};
