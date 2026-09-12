/** Jest config for the performance harness (kept out of the normal test run). */
module.exports = {
    rootDir: '..',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/perf/*.test.ts', '<rootDir>/perf/*.test.tsx'],
    setupFilesAfterEnv: ['<rootDir>/config.js'],
    testTimeout: 900000,
    moduleNameMapper: {
        '\\.(mp3|wav|ogg|png|jpe?g|gif|svg|css|webmanifest|ico)$': '<rootDir>/perf/asset-stub.js',
        '^nanoid$': '<rootDir>/perf/nanoid-stub.js',
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: {
                jsx: 'react-jsx',
                target: 'ESNext',
                module: 'CommonJS',
                moduleResolution: 'node10',
                ignoreDeprecations: '6.0',
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
                resolveJsonModule: true,
                skipLibCheck: true,
                strict: false,
                lib: ['DOM', 'DOM.Iterable', 'ESNext'],
                types: ['jest', 'node'],
            },
        }],
    },
};
