import tseslint from "typescript-eslint";

export default [
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: ["src/generated/**", "dist/**", "node_modules/**"],
  },
];
