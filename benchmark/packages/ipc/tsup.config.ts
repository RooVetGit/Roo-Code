import { defineConfig } from "tsup"

export default defineConfig([
	{
		entry: ["src/index.ts"],
		dts: true,
		outDir: "dist",
		clean: true,
		format: ["cjs"],
		tsconfig: "./tsconfig.cjs.json",
		outExtension: () => ({ js: ".cjs" }),
		noExternal: ["node-ipc"],
	},
])
