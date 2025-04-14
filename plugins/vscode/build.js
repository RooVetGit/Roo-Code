const esbuild = require("esbuild")
const fs = require("fs-extra") // Use fs-extra for easier recursive copy
const path = require("path")

/**
 * General copy function, automatically determines file or directory
 */
function copyFileOrDir(src, dst, opts = { overwrite: true }) {
	if (!fs.existsSync(src)) {
		console.warn(`[copyFileOrDir] Source not found: ${src}`)
		return
	}
	// Remove the target first, compatible with prepack.js behavior
	try {
		if (fs.existsSync(dst)) {
			const stat = fs.lstatSync(dst)
			if (stat.isDirectory() || stat.isSymbolicLink()) {
				fs.removeSync(dst)
			} else {
				fs.unlinkSync(dst)
			}
		}
	} catch (e) {
		// Ignore exceptions such as not existing
	}
	const stat = fs.lstatSync(src)
	if (stat.isDirectory()) {
		fs.copySync(src, dst, opts)
		console.log(`[copyFileOrDir] Copied directory ${src} -> ${dst}`)
	} else {
		fs.copyFileSync(src, dst)
		console.log(`[copyFileOrDir] Copied file ${src} -> ${dst}`)
	}
}

/**
 * Batch copy
 */
function batchCopy(items) {
	for (const { src, dst, opts } of items) {
		copyFileOrDir(src, dst, opts)
	}
}

/**
 * Reset directory (delete and recreate)
 */
function resetDir(dir) {
	if (fs.existsSync(dir)) {
		fs.removeSync(dir)
		console.log(`[resetDir] Removed directory ${dir}`)
	}
	fs.ensureDirSync(dir)
	console.log(`[resetDir] Created directory ${dir}`)
}

const args = process.argv.slice(2)
const production = args.includes("--production")
const watch = args.includes("--watch")
const baseDirArg = args.find((arg) => arg.startsWith("--baseDir="))
const baseDir = baseDirArg ? path.resolve(baseDirArg.split("=")[1]) : __dirname // Use baseDir argument or __dirname for correct plugin path

console.log(`Running esbuild with baseDir: ${baseDir}`)

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

const copyWasmFiles = {
	name: "copy-wasm-files",
	setup(build) {
		build.onEnd(() => {
			const nodeModulesDir = path.join(baseDir, "node_modules")
			const treeSitterSourceDir = path.join(nodeModulesDir, "web-tree-sitter")
			const targetDir = path.join(baseDir, "dist")
			fs.ensureDirSync(targetDir)

			// tree-sitter.wasm
			copyFileOrDir(path.join(treeSitterSourceDir, "tree-sitter.wasm"), path.join(targetDir, "tree-sitter.wasm"))

			// language-specific WASM files
			const languageWasmDir = path.join(nodeModulesDir, "tree-sitter-wasms", "out")
			const languages = [
				"typescript",
				"tsx",
				"python",
				"rust",
				"javascript",
				"go",
				"cpp",
				"c",
				"c_sharp",
				"ruby",
				"java",
				"php",
				"swift",
				"kotlin",
			]
			languages.forEach((lang) => {
				copyFileOrDir(
					path.join(languageWasmDir, `tree-sitter-${lang}.wasm`),
					path.join(targetDir, `tree-sitter-${lang}.wasm`),
				)
			})
		})
	},
}

// Simple function to copy locale files
function copyLocaleFiles(baseDir) {
	const srcDir = path.join(baseDir, "..", "..", "src", "i18n", "locales")
	const destDir = path.join(baseDir, "dist", "i18n", "locales")
	const outDir = path.join(baseDir, "out", "i18n", "locales")
	if (!fs.existsSync(srcDir)) {
		console.warn(`[copyLocaleFiles] Source locales directory does not exist: ${srcDir}`)
		return
	}
	fs.ensureDirSync(destDir)
	try {
		fs.ensureDirSync(outDir)
	} catch (e) {}
	batchCopy([
		{ src: srcDir, dst: destDir },
		// Uncomment the following line if you need the out directory
		// { src: srcDir, dst: outDir }
	])
}

// Set up file watcher if in watch mode
function setupLocaleWatcher(baseDir) {
	if (!watch) return

	const localesDir = path.join(baseDir, "src", "i18n", "locales")

	// Ensure the locales directory exists before setting up watcher
	if (!fs.existsSync(localesDir)) {
		console.warn(`Cannot set up watcher: Source locales directory does not exist: ${localesDir}`)
		return
	}

	console.log(`Setting up watcher for locale files in ${localesDir}`)

	// Use a debounce mechanism
	let debounceTimer = null
	const debouncedCopy = () => {
		if (debounceTimer) clearTimeout(debounceTimer)
		debounceTimer = setTimeout(() => {
			console.log("Locale files changed, copying...")
			copyLocaleFiles(baseDir)
		}, 300) // Wait 300ms after last change before copying
	}

	// Watch the locales directory
	try {
		fs.watch(localesDir, { recursive: true }, (eventType, filename) => {
			if (filename && filename.endsWith(".json")) {
				console.log(`Locale file ${filename} changed, triggering copy...`)
				debouncedCopy()
			}
		})
		console.log("Watcher for locale files is set up")
	} catch (error) {
		console.error(`Error setting up watcher for ${localesDir}:`, error.message)
	}
}

const copyLocalesFiles = {
	name: "copy-locales-files",
	setup(build) {
		build.onEnd(() => {
			copyLocaleFiles(baseDir) // Pass baseDir
		})
	},
}

const extensionConfig = {
	bundle: true,
	minify: production,
	sourcemap: !production,
	logLevel: "silent",
	plugins: [
		copyWasmFiles,
		copyLocalesFiles,
		/* add to the end of plugins array */
		esbuildProblemMatcherPlugin,
		{
			name: "alias-plugin",
			setup(build) {
				build.onResolve({ filter: /^pkce-challenge$/ }, (args) => {
					return { path: require.resolve("pkce-challenge/dist/index.browser.js") }
				})
			},
		},
	],
	entryPoints: ["src/extension.ts"],
	format: "cjs",
	sourcesContent: false,
	platform: "node",
	outfile: "dist/extension.js",
	external: ["vscode"],
}

async function main() {
	const ROOT_DIR = path.resolve(baseDir, "../..")
	const TARGET_DIR = baseDir
	resetDir(path.join(TARGET_DIR, "bin"))
	const sharedItems = ["LICENSE", "README.md", "CHANGELOG.md", "PRIVACY.md", "locales", "assets"]
	batchCopy(
		sharedItems.map((item) => ({
			src: path.join(ROOT_DIR, item),
			dst: path.join(TARGET_DIR, path.basename(item)),
		})),
	)

	// Copy webview build output
	const webviewSourceDir = path.resolve(baseDir, "..", "..", "webview-ui", "build")
	const webviewTargetDir = path.join(baseDir, "webview-ui", "build")
	copyFileOrDir(webviewSourceDir, webviewTargetDir)

	// Copy default theme files
	const themeSourceDir = path.join(baseDir, "src", "integrations", "theme", "default-themes")
	const themeTargetDir = path.join(baseDir, "dist", "integrations", "theme", "default-themes")
	copyFileOrDir(themeSourceDir, themeTargetDir)

	const extensionCtx = await esbuild.context(extensionConfig)

	if (watch) {
		await extensionCtx.watch()
		console.log("Copying locale files initially...")
		copyLocaleFiles(baseDir)
		setupLocaleWatcher(ROOT_DIR)
	} else {
		await extensionCtx.rebuild()
		await extensionCtx.dispose()
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
