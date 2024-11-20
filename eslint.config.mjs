// @ts-check

import globals from "globals";
import pluginJs from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import tseslint from "typescript-eslint";

export default tseslint.config(
  pluginJs.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["**/*.{cjs,js,mjs,ts}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      // Deviations from < https://eslint.org/docs/rules/#best-practices >
      // No console logging
      "no-console": "error",
      // No coercion unless comparing against null
      "eqeqeq": ["warn", "smart"],
      // require an if statement with for-in loops
      "guard-for-in": "warn",
      // no 'if () { return } else { ... }
      "no-else-return": "warn",
      // no eval()
      "no-eval": "warn",
      // no trailing decimals after numbers
      "no-floating-decimal": "warn",
      // see: https://eslint.org/docs/rules/no-lone-blocks
      "no-lone-blocks": "warn",
      // no repeating spaces
      "no-multi-spaces": "warn",
      // must throw an error instance
      "no-throw-literal": "warn",
      // see: https://eslint.org/docs/rules/no-unused-expressions#disallow-unused-expressions-no-unused-expressions
      "no-unused-expressions": "warn",
      // no with statements
      "no-with": "warn",
      // immediately called functions must be wrapped in ()'s
      "wrap-iife": ["warn", "any"],
      "no-async-promise-executor": "off",
      "no-prototype-builtins": "off",

      // Deviation from < https://eslint.org/docs/rules/#strict-mode >
      // disabled b/c typescript
      "strict": "off",

      // Deviation from < https://eslint.org/docs/rules/#variables >
      // require vars to be defined before use
      "no-use-before-define": "warn",
      "prefer-const": "warn",

      // Deviation from < https://eslint.org/docs/rules/#stylistic-issues >
      // Parentheses around arrow function parameters
      "arrow-parens": [
        "warn",
        "as-needed",
        { requireForBlockBody: true },
      ],
      // Spaces around array []'s
      "array-bracket-spacing": "warn",
      // {}'s must have whitespace around them
      "block-spacing": "warn",
      // See: https://eslint.org/docs/rules/brace-style#require-brace-style-brace-style
      "brace-style": "warn",
      // useCamelCasePleaseKThanks
      "camelcase": "warn",
      // No trailing commas in single-line, warn when missing in multiline
      "comma-dangle": ["warn", "always-multiline"],
      // Require space after commas
      "comma-spacing": "warn",
      // See: https://eslint.org/docs/rules/comma-style
      "comma-style": "warn",
      // No whitespace when using object[thing]
      "computed-property-spacing": "warn",
      // Must wrap blocks with {}
      "curly": "warn",
      // Superseded by TS
      "indent": "off",
      // Exactly one space after object key colons
      "key-spacing": [
        "warn",
        { mode: "strict" },
      ],
      // Spaces around keywords
      "keyword-spacing": "warn",
      // Constructors must start with capital letter
      "new-cap": "warn",
      // no trailing spaces
      "no-trailing-spaces": "warn",
      // semi-colons required
      "semi": "warn",
      // space after semi-colon, no space before
      "semi-spacing": [
        "warn",
        {
          before: false,
          after: true,
        }
      ],
      // See: https://eslint.org/docs/rules/semi-style
      "semi-style": "warn",
      // whitespace required before and after {}
      "space-before-blocks": "warn",
      // See: https://eslint.org/docs/rules/space-in-parens
      "space-in-parens": ["warn", "never"],
      // Spaces required around operators
      "space-infix-ops": "warn",
      // See: https://eslint.org/docs/rules/space-unary-ops
      "space-unary-ops": "warn",
      // Spaces after case colon
      "switch-colon-spacing": "warn",

      // Deviations from < https://eslint.org/docs/rules/#ecmascript-6 >
      // Spaces required around fat-arrow function's "=>"
      "arrow-spacing": "warn",
      // Don't use arrows functions in conditions
      "no-confusing-arrow": "warn",
      // Use let/const instead of var
      "no-var": "warn",

      // Other deviations
      "no-debugger": "warn",
      "no-empty": ["error", { allowEmptyCatch: true }],
      // @typescript-eslint handles this better
      "no-unused-vars": "off",
      // no concat'ing literal strings
      "no-useless-concat": "error",
      // warn about todo comments
      "no-warning-comments": [
        "warn",
        {
          location: "start",
          terms: [
            "todo",
            "to do",
            "fix",
            "fixme",
            "fix me",
            "need",
          ],
        },
      ],
      // Use template strings instead of + concat
      "prefer-template": "warn",
      "template-curly-spacing": ["warn", "never"],

      // @stylistic
      "@stylistic/indent": [
        "warn", 2,
      ],
      "@stylistic/max-len": [
        "warn",
        {
          "code": 80,
          "ignoreComments": false,
          "ignoreUrls": true,
        },
      ],

      // @typescript-eslint
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/ban-types": "warn",
      // Warn all unused, unless arg comes before a later used one or arg name
      // starts with an underscore
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "args": "after-used",
          "argsIgnorePattern": "^_",
          "vars": "all",
        },
      ],
      // Superseded by stylistic
      "@typescript-eslint/indent": "off",
    },
  },
);
