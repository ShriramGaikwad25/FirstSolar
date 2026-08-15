import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
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
    },
  },
];

export default eslintConfig;
