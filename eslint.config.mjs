// @ts-check

import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,

  { files: ["**/*.{cjs,js,mjs,ts}"] },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    rules: {
      // Deviations from < https://eslint.org/docs/rules/#best-practices >
      "no-console": "error", // No console logging
      "eqeqeq": ["warn", "smart"], // No coersion unless comparing against null
      "guard-for-in": "warn", // require an if statement with for-in loops
      "no-else-return": "warn", // no 'if () { return } else { ... }
      "no-eval": "warn", // no eval()
      "no-floating-decimal": "warn", // no trailing decimals after numbers
      "no-lone-blocks": "warn", // see: https://eslint.org/docs/rules/no-lone-blocks
      "no-multi-spaces": "warn", // no repeating spaces
      "no-throw-literal": "warn", // must throw an error instance
      "no-unused-expressions": "warn", // see: https://eslint.org/docs/rules/no-unused-expressions#disallow-unused-expressions-no-unused-expressions
      "no-with": "warn", // no with statements
      "wrap-iife": ["warn", "any"], // immediately called functions must be wrapped in ()'s
      "no-async-promise-executor": "off",
      "no-prototype-builtins": "off",

      // Deviation from < https://eslint.org/docs/rules/#strict-mode >
      "strict": "off", // disabled b/c typescript

      // Deviation from < https://eslint.org/docs/rules/#variables >
      "no-use-before-define": "warn", // require vars to be defined before use
      "prefer-const": "warn",

      // Deviation from < https://eslint.org/docs/rules/#stylistic-issues >
      "arrow-parens": ["warn", "as-needed", { requireForBlockBody: true }], // Parentheses around arrow function parameters
      "array-bracket-spacing": "warn", // Spaces around array []'s
      "block-spacing": "warn", // {}'s must have whitespace around them
      "brace-style": "warn", // See: https://eslint.org/docs/rules/brace-style#require-brace-style-brace-style
      "camelcase": "warn", // useCamelCasePleaseKThanks
      "comma-dangle": ["warn", "always-multiline"], // No trailing commas in single-line, warn when missing in multiline
      "comma-spacing": "warn", // Require space after commas
      "comma-style": "warn", // See: https://eslint.org/docs/rules/comma-style
      "computed-property-spacing": "warn", // No whitespace when using object[thing]
      "curly": "warn", // Must wrap blocks with {}
      "indent": "off", // Superseded by TS
      "key-spacing": ["warn", { mode: "strict" }], // Exactly one space after object key colons
      "keyword-spacing": "warn", // Spaces around keywords
      "new-cap": "warn", // Constructors must start with capital letter
      "no-trailing-spaces": "warn", // no trailing spaces
      "semi": "warn", // semi-colons required
      "semi-spacing": ["warn", { before: false, after: true }], // space after semi-colon, no space before
      "semi-style": "warn", // See: https://eslint.org/docs/rules/semi-style
      "space-before-blocks": "warn", // whitespace required before and after {}
      "space-in-parens": ["warn", "never"], // See: https://eslint.org/docs/rules/space-in-parens
      "space-infix-ops": "warn", // Spaces required around operators
      "space-unary-ops": "warn", // See: https://eslint.org/docs/rules/space-unary-ops
      "switch-colon-spacing": "warn", // Spaces after case colon

      // Deviation from < https://eslint.org/docs/rules/#ecmascript-6 >
      "arrow-spacing": "warn", // Spaces required around fat-arrow function's "=>"
      "no-confusing-arrow": "warn", // Don't use arrows functions in conditions
      "no-var": "warn", // Use let/const instead of var

      // Other deviations
      "no-unused-vars": "warn",
      "prefer-template": "warn", // Use template strings instead of + concat
      "template-curly-spacing": ["warn", "never"],
      "no-useless-concat": "error", // no concat'ing literal strings
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-debugger": "warn",
      "no-warning-comments": [
        "warn",
        { terms: ["todo", "to do", "fix", "fixme", "fix me", "need"], location: "start" }
      ], // warn about todo comments

      // typescript
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/ban-types": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/indent": ["warn", 2],
    }
  },
);
