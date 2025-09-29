module.exports = {
    testEnvironment: 'node',
    testMatch: [
        '**/tests/**/*.test.js'
    ],
    collectCoverageFrom: [
        '**/*.js',
        '!node_modules/**',
        '!tests/**',
        '!coverage/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    setupFiles: ['<rootDir>/tests/setupEnv.js'],
    testTimeout: 30000,
    clearMocks: true,
    resetModules: true,
    verbose: true
};