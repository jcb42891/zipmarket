module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: [
      "./apps/etl/tsconfig.json",
      "./packages/db/tsconfig.json",
      "./packages/shared/tsconfig.json"
    ]
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: {
    node: true,
    es2022: true
  },
  ignorePatterns: ["**/dist/**", "**/.next/**", "**/node_modules/**", "apps/web/**"]
};
