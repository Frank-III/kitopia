import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "src/index.ts",
  outDir: "dist",

  format: "esm",
  minify: true,

  dts: {
    entry: "src/index.ts",
  },
  hash: false,
  tsconfig: "tsconfig.json",
});
