import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,vue}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-undef': 'off', // TypeScript handles this
    },
  },
]