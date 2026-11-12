module.exports = {
  testMatch: ['<rootDir>/test/*.spec.ts?(x)'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs', moduleResolution: 'node', jsx: 'react-jsx' } }],
  },
  testEnvironment: 'node',
  reporters: ['default', 'jest-junit'],
};
