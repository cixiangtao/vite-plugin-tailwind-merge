import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  format: ["esm", "cjs"],
  dts: {
    sourcemap: true,
  },
  deps: {
    dts: {
      neverBundle: true,
    },
  },
  fixedExtension: false,
  sourcemap: true,
  clean: true,
  target: "node20",
  outDir: "dist",
  outputOptions: {
    exports: "named",
  },
});
