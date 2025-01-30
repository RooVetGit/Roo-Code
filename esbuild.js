const esbuild = require("esbuild")
const { copy } = require("esbuild-plugin-copy")
const fs = require("fs")
const path = require("path")

const production = process.argv.includes("--production")
const watch = process.argv.includes("--watch")

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: "esbuild-problem-matcher",

	setup(build) {
		build.onStart(() => {
			console.log("[watch] build started")
		})
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`)
				console.error(`    ${location.file}:${location.line}:${location.column}:`)
			})
			console.log("[watch] build finished")
		})
	},
}

// Plugin to handle native .node files
const nativeNodeModulesPlugin = {
	name: "native-node-modules",
	setup(build) {
		// Mark .node files as external to prevent esbuild from trying to bundle them
		build.onResolve({ filter: /\.node$/ }, (args) => ({
			path: args.path,
			external: true,
		}))
	},
}

const extensionConfig = {
	bundle: true,
	minify: production,
	sourcemap: !production,
	logLevel: "silent",
	plugins: [
		copy({
			resolveFrom: "cwd",
			assets: [
				{
					from: "./node_modules/tree-sitter-wasms/out/**/*.wasm",
					to: "./dist/",
				},
				{
					from: "./node_modules/web-tree-sitter/tree-sitter.wasm",
					to: "./dist/",
				},
				{
					from: "./node_modules/lancedb/dist/*.node",
					to: "./dist/",
				},
			],
			watch: true,
		}),
		nativeNodeModulesPlugin,
		esbuildProblemMatcherPlugin,
	],
	entryPoints: ["src/extension.ts"],
	format: "cjs",
	sourcesContent: false,
	platform: "node",
	outfile: "dist/extension.js",
	external: ["vscode"],
	loader: { ".node": "file" },
}

async function main() {
	const extensionCtx = await esbuild.context(extensionConfig)
	if (watch) {
		await extensionCtx.watch()
	} else {
		await extensionCtx.rebuild()
		await extensionCtx.dispose()
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
