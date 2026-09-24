import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: ['node_modules/', 'css/']
    },
    js.configs.recommended,
    {
        files: ['js/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                katex: 'readonly'
            }
        }
    },
    {
        files: ['test/**/*.js', 'scripts/**/*.js', '*.config.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node
            }
        }
    },
    {
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }]
        }
    }
];
