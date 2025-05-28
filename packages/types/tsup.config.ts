import { defineConfig } from "tsup"

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["cjs", "esm"],
	dts: true,
	clean: false,
	splitting: false,
	sourcemap: true,
	outDir: "dist",
	outExtension({ format }) {
		return {
			js: format === "cjs" ? ".cjs" : ".mjs",
			dts: format === "cjs" ? ".d.cts" : ".d.mts",
		}
	},
})
