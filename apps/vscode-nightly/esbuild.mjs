import * as esbuild from "esbuild"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"

import { copyPaths, copyLocales, copyWasms } from "@roo-code/build"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
	const production = process.argv.includes("--production")
	const minify = production
	const sourcemap = !production

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const buildOptions = {
		bundle: true,
		minify,
		sourcemap,
		logLevel: "silent",
		format: "cjs",
		sourcesContent: false,
		platform: "node",
	}

	const srcDir = path.join(__dirname, "..", "..", "src")
	const buildDir = path.join(__dirname, "build")
	const distDir = path.join(buildDir, "dist")

	/**
	 * @type {import('esbuild').Plugin[]}
	 */
	const plugins = [
		{
			name: "copy-src",
			setup(build) {
				build.onEnd(() => {
					const paths = [
						["LICENSE", "LICENSE"],
						[".vscodeignore", ".vscodeignore"],
						["assets", "assets"],
						["integrations", "integrations"],
						["node_modules/vscode-material-icons/generated", "assets/vscode-material-icons"],
						["../webview-ui/audio", "webview-ui/audio"],
					]

					copyPaths(paths, srcDir, buildDir)

					let count = 0

					fs.readdirSync(path.join(srcDir)).forEach((file) => {
						if (file.startsWith("package.nls")) {
							fs.copyFileSync(path.join(srcDir, file), path.join(buildDir, file))
							count++
						}
					})

					console.log(`[copy-src] Copied ${count} package.nls*.json files to ${buildDir}`)
				})
			},
		},
		{
			name: "generate-package-json",
			setup(build) {
				build.onEnd(() => {
					const packageJson = JSON.parse(fs.readFileSync(path.join(srcDir, "package.json"), "utf8"))

					const packageNightlyJson = JSON.parse(
						fs.readFileSync(path.join(__dirname, "package.nightly.json"), "utf8"),
					)

					fs.writeFileSync(
						path.join(buildDir, "package.json"),
						JSON.stringify({ ...packageJson, ...packageNightlyJson }, null, 2),
					)

					console.log(`[generate-package-json] Generated package.json from package.nightly.json`)
				})
			},
		},
		{
			name: "copy-wasms",
			setup(build) {
				build.onEnd(() => {
					copyWasms(srcDir, distDir)
				})
			},
		},
		{
			name: "copy-locales",
			setup(build) {
				build.onEnd(() => {
					copyLocales(srcDir, distDir)
				})
			},
		},
	]

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const extensionBuildOptions = {
		...buildOptions,
		plugins,
		entryPoints: [path.join(srcDir, "extension.ts")],
		outfile: path.join(distDir, "extension.js"),
		external: ["vscode"],
	}

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const workerBuildOptions = {
		...buildOptions,
		entryPoints: [path.join(srcDir, "workers", "countTokens.ts")],
		outdir: path.join(distDir, "workers"),
	}

	const [extensionBuildContext, workerBuildContext] = await Promise.all([
		esbuild.context(extensionBuildOptions),
		esbuild.context(workerBuildOptions),
	])

	await Promise.all([
		extensionBuildContext.rebuild(),
		extensionBuildContext.dispose(),

		workerBuildContext.rebuild(),
		workerBuildContext.dispose(),
	])
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
