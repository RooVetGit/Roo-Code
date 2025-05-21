import * as fs from "fs"
import * as path from "path"

/**
 * Copies all files or directories from source to destination
 * @param paths Array of file or directory paths to copy
 * @param srcDir Source directory path
 * @param dstDir Destination directory path
 */
export function copyPaths(copyPaths: [string, string][], srcDir: string, dstDir: string) {
	copyPaths.forEach(([srcRelPath, dstRelPath]) => {
		const stats = fs.lstatSync(path.join(srcDir, srcRelPath))

		console.log(`[copy-src] ${srcRelPath} -> ${dstRelPath}`)

		if (stats.isDirectory()) {
			if (fs.existsSync(path.join(dstDir, dstRelPath))) {
				fs.rmSync(path.join(dstDir, dstRelPath), { recursive: true })
			}

			fs.mkdirSync(path.join(dstDir, dstRelPath), { recursive: true })

			const count = copyDir(path.join(srcDir, srcRelPath), path.join(dstDir, dstRelPath), 0)
			console.log(`[copy-src] Copied ${count} files from ${srcRelPath} to ${dstRelPath}`)
		} else {
			fs.copyFileSync(path.join(srcDir, srcRelPath), path.join(dstDir, dstRelPath))
			console.log(`[copy-src] Copied ${srcRelPath} to ${dstRelPath}`)
		}
	})
}

/**
 * Recursively copies files from source directory to destination directory
 * @param srcDir Source directory path
 * @param dstDir Destination directory path
 * @param count Counter for number of files copied
 * @returns Updated count of files copied
 */
export function copyDir(srcDir: string, dstDir: string, count: number): number {
	const entries = fs.readdirSync(srcDir, { withFileTypes: true })

	for (const entry of entries) {
		const srcPath = path.join(srcDir, entry.name)
		const dstPath = path.join(dstDir, entry.name)

		if (entry.isDirectory()) {
			fs.mkdirSync(dstPath, { recursive: true })
			count = copyDir(srcPath, dstPath, count)
		} else {
			count = count + 1
			fs.copyFileSync(srcPath, dstPath)
		}
	}

	return count
}

/**
 * Copies WASM files from node_modules to the distribution directory
 * @param srcDir Source directory path
 * @param distDir Distribution directory path
 */
export function copyWasms(srcDir: string, distDir: string): void {
	const nodeModulesDir = path.join(srcDir, "node_modules")

	fs.mkdirSync(distDir, { recursive: true })

	// Tiktoken WASM file.
	fs.copyFileSync(
		path.join(nodeModulesDir, "tiktoken", "lite", "tiktoken_bg.wasm"),
		path.join(distDir, "tiktoken_bg.wasm"),
	)

	console.log(`[copy-wasm-files] Copied tiktoken WASMs to ${distDir}`)

	// Also copy Tiktoken WASMs to the workers directory.
	const workersDir = path.join(distDir, "workers")
	fs.mkdirSync(workersDir, { recursive: true })

	fs.copyFileSync(
		path.join(nodeModulesDir, "tiktoken", "lite", "tiktoken_bg.wasm"),
		path.join(workersDir, "tiktoken_bg.wasm"),
	)

	console.log(`[copy-wasm-files] Copied tiktoken WASMs to ${workersDir}`)

	// Main tree-sitter WASM file.
	fs.copyFileSync(
		path.join(nodeModulesDir, "web-tree-sitter", "tree-sitter.wasm"),
		path.join(distDir, "tree-sitter.wasm"),
	)

	console.log(`[copy-wasm-files] Copied tree-sitter.wasm to ${distDir}`)

	// Copy language-specific WASM files.
	const languageWasmDir = path.join(nodeModulesDir, "tree-sitter-wasms", "out")

	if (!fs.existsSync(languageWasmDir)) {
		throw new Error(`Directory does not exist: ${languageWasmDir}`)
	}

	// Dynamically read all WASM files from the directory instead of using a hardcoded list.
	const wasmFiles = fs.readdirSync(languageWasmDir).filter((file) => file.endsWith(".wasm"))

	wasmFiles.forEach((filename) => {
		fs.copyFileSync(path.join(languageWasmDir, filename), path.join(distDir, filename))
	})

	console.log(`[copy-wasm-files] Copied ${wasmFiles.length} tree-sitter language wasms to ${distDir}`)
}

/**
 * Copies locale files to the distribution directory
 * @param srcDir Source directory path
 * @param distDir Distribution directory path
 */
export function copyLocales(srcDir: string, distDir: string): void {
	const destDir = path.join(distDir, "i18n", "locales")
	fs.mkdirSync(destDir, { recursive: true })
	const count = copyDir(path.join(srcDir, "i18n", "locales"), destDir, 0)
	console.log(`[copy-locales-files] Copied ${count} locale files to ${destDir}`)
}
