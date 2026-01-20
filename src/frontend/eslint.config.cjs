/**
 * Flat ESLint config (eslint.config.cjs) for the frontend
 * Uses the new "ignores" property instead of .eslintignore
 */
module.exports = [
    {
        ignores: [
            'node_modules/**',
            '.expo/**',
            '.expo-shared/**',
            'android/**',
            'ios/**',
            'dist/**',
            'build/**',
            '*.log',
        ],
    },
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: require('@typescript-eslint/parser'),
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: { jsx: true },
                project: './tsconfig.json',
            },
        },
        plugins: {
            react: require('eslint-plugin-react'),
            'react-hooks': require('eslint-plugin-react-hooks'),
            '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
        },
        settings: {
            react: { version: 'detect' },
        },
        rules: {},
    },
    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: { jsx: true },
            },
        },
        plugins: {
            react: require('eslint-plugin-react'),
            'react-hooks': require('eslint-plugin-react-hooks'),
        },
        settings: {
            react: { version: 'detect' },
        },
        rules: {},
    },
];
