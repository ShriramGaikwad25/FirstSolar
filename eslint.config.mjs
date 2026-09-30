import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/**"]),
  {
    rules: {
      // Loosen rules for incremental cleanup without breaking builds
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }
      ],
      "prefer-const": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "@next/next/no-img-element": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "react/no-unescaped-entities": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      // React Compiler rules added in eslint-plugin-react-hooks 6+; existing code predates them
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);

export default eslintConfig;
