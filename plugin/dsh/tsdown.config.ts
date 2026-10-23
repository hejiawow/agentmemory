import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "lib",
  format: ["esm"],
  fixedExtension: false,
  target: "node20",
  clean: true,
  sourcemap: false,
  dts: true,
});
