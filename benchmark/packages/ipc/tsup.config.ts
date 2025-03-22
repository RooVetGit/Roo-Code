import { defineConfig } from "tsup"

export default defineConfig([
	{
		entry: ["src/index.ts"],
		format: ["esm"],
		dts: true,
		outDir: "dist",
		tsconfig: "./tsconfig.json",
		clean: true,
	},
	{
		entry: ["src/index.ts"],
		format: ["cjs"],
		dts: false,
		outDir: "dist",
		tsconfig: "./tsconfig.cjs.json",
		outExtension: () => ({ js: ".cjs" }),
		clean: false,
		noExternal: ["node-ipc"],
	},
])
