import { spawn, execSync, type ChildProcess } from "child_process"
import * as path from "path"
import * as fs from "fs"
import { watch, type FSWatcher } from "fs"
import { fileURLToPath } from "url"

// @ts-expect-error - TS1470: We only run this script with tsx so it will never
// compile to CJS and it's safe to ignore this tsc error.
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface PackageConfig {
	readonly name: string
	readonly sourcePath: string
	readonly targetPaths: readonly string[]
	readonly npmPath?: string
	readonly watchCommand?: string
}

interface Config {
	readonly packages: readonly PackageConfig[]
}

interface WatcherResult {
	child: ChildProcess
	watcher: FSWatcher | null
}

interface NpmPackage {
	name?: string
	version?: string
	type: "module"
	dependencies: Record<string, string>
	main: string
	module: string
	types: string
	exports: {
		".": {
			types: string
			import: string
			require: {
				types: string
				default: string
			}
		}
	}
	files: string[]
}

const config: Config = {
	packages: [
		{
			name: "@roo-code/cloud",
			sourcePath: "../Roo-Code-Cloud/packages/sdk",
			targetPaths: ["src/node_modules/@roo-code/cloud"],
			npmPath: "npm",
			watchCommand: "pnpm build:development:watch",
		},
	],
} as const

const args = process.argv.slice(2)
const packageName = args.find((arg) => !arg.startsWith("--"))
const watchMode = !args.includes("--no-watch")
const unlink = args.includes("--unlink")

const packages: readonly PackageConfig[] = packageName
	? config.packages.filter((p) => p.name === packageName)
	: config.packages

if (!packages.length) {
	console.error(`Package '${packageName}' not found`)
	process.exit(1)
}

function pathExists(filePath: string): boolean {
	try {
		fs.accessSync(filePath)
		return true
	} catch {
		return false
	}
}

function copyRecursiveSync(src: string, dest: string): void {
	const exists = pathExists(src)

	if (!exists) {
		return
	}

	const stats = fs.statSync(src)
	const isDirectory = stats.isDirectory()

	if (isDirectory) {
		if (!pathExists(dest)) {
			fs.mkdirSync(dest, { recursive: true })
		}

		const children = fs.readdirSync(src)

		children.forEach((childItemName) => {
			copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName))
		})
	} else {
		fs.copyFileSync(src, dest)
	}
}

function generateNpmPackageJson(sourcePath: string, npmPath: string): void {
	const npmDir = path.join(sourcePath, npmPath)
	const npmPackagePath = path.join(npmDir, "package.json")
	const npmMetadataPath = path.join(npmDir, "package.metadata.json")
	const monorepoPackagePath = path.join(sourcePath, "package.json")

	if (pathExists(npmPackagePath)) {
		return
	}

	if (!pathExists(npmMetadataPath)) {
		return
	}

	try {
		const monorepoPackageContent = fs.readFileSync(monorepoPackagePath, "utf8")
		const monorepoPackage = JSON.parse(monorepoPackageContent) as {
			dependencies?: Record<string, string>
		}

		const npmMetadataContent = fs.readFileSync(npmMetadataPath, "utf8")
		const npmMetadata = JSON.parse(npmMetadataContent) as Partial<NpmPackage>

		const npmPackage: NpmPackage = {
			...npmMetadata,
			type: "module",
			dependencies: monorepoPackage.dependencies || {},
			main: "./dist/index.cjs",
			module: "./dist/index.js",
			types: "./dist/index.d.ts",
			exports: {
				".": {
					types: "./dist/index.d.ts",
					import: "./dist/index.js",
					require: {
						types: "./dist/index.d.cts",
						default: "./dist/index.cjs",
					},
				},
			},
			files: ["dist"],
		}

		fs.writeFileSync(npmPackagePath, JSON.stringify(npmPackage, null, 2) + "\n")
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(`❌ Failed to generate npm/package.json: ${errorMessage}`)
	}
}

function linkPackage(pkg: PackageConfig, silent = false): void {
	const sourcePath = path.resolve(__dirname, "..", pkg.sourcePath)

	if (!pathExists(sourcePath)) {
		console.error(`❌ Source not found: ${sourcePath}`)
		process.exit(1)
	}

	if (pkg.npmPath) {
		generateNpmPackageJson(sourcePath, pkg.npmPath)
	}

	for (const currentTargetPath of pkg.targetPaths) {
		const targetPath = path.resolve(__dirname, "..", currentTargetPath)

		if (pathExists(targetPath)) {
			fs.rmSync(targetPath, { recursive: true, force: true })
		}

		const parentDir = path.dirname(targetPath)
		fs.mkdirSync(parentDir, { recursive: true })

		const linkSource = pkg.npmPath ? path.join(sourcePath, pkg.npmPath) : sourcePath

		copyRecursiveSync(linkSource, targetPath)

		const indexDtsPath = path.join(targetPath, "index.d.ts")
		const distIndexDtsPath = path.join(targetPath, "dist", "index.d.ts")

		if (!pathExists(indexDtsPath) && pathExists(distIndexDtsPath)) {
			fs.writeFileSync(indexDtsPath, "export * from './dist/index';\n")
		} else if (pathExists(indexDtsPath)) {
			const content = fs.readFileSync(indexDtsPath, "utf8")

			const fixedContent = content.replace(/export \* from '\/[^']+'/g, "export * from './dist/index'")

			if (content !== fixedContent) {
				fs.writeFileSync(indexDtsPath, fixedContent)
			}
		}

		const packageJsonPath = path.join(targetPath, "package.json")

		if (pathExists(packageJsonPath)) {
			const packageContent = fs.readFileSync(packageJsonPath, "utf8")
			const packageJson = JSON.parse(packageContent)

			if (!pathExists(path.join(targetPath, packageJson.types || ""))) {
				if (pathExists(distIndexDtsPath)) {
					packageJson.types = "./dist/index.d.ts"
				} else if (pathExists(indexDtsPath)) {
					packageJson.types = "./index.d.ts"
				}

				fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n")
			}
		}

		if (!silent) {
			const shortPath = currentTargetPath.replace(/node_modules\/@roo-code\/types$/, "")

			console.log(`📦 Copied ${pkg.name} → ${shortPath}`)
		}
	}
}

function unlinkPackage(pkg: PackageConfig): void {
	for (const currentTargetPath of pkg.targetPaths) {
		const targetPath = path.resolve(__dirname, "..", currentTargetPath)

		if (pathExists(targetPath)) {
			fs.rmSync(targetPath, { recursive: true, force: true })
			const shortPath = currentTargetPath.replace(/node_modules\/@roo-code\/types$/, "")

			console.log(`🗑️  Removed ${pkg.name} from ${shortPath}`)
		}
	}
}

function startWatch(pkg: PackageConfig): WatcherResult {
	if (!pkg.watchCommand) {
		throw new Error(`Package ${pkg.name} has no watch command configured`)
	}

	const commandParts = pkg.watchCommand.split(" ")
	const [cmd, ...args] = commandParts

	if (!cmd) {
		throw new Error(`Invalid watch command for ${pkg.name}`)
	}

	console.log(`🔨 Building ${pkg.name}...`)

	const child = spawn(cmd, args, {
		cwd: path.resolve(__dirname, "..", pkg.sourcePath),
		stdio: "pipe",
		shell: true,
	})

	let buildStartTime = Date.now()
	let isFirstBuild = true

	if (child.stdout) {
		child.stdout.on("data", (data: Buffer) => {
			const output = data.toString()

			if (
				output.includes("built successfully") ||
				output.includes("Build completed") ||
				output.includes("✅") ||
				output.includes("Watching for file changes")
			) {
				const buildTime = ((Date.now() - buildStartTime) / 1000).toFixed(1)

				if (isFirstBuild) {
					console.log(`✅ Initial build complete (${buildTime}s)`)
					isFirstBuild = false
				} else {
					console.log(`✅ Rebuild complete (${buildTime}s)`)
				}
			}

			if (output.includes("Building") || output.includes("Rebuilding")) {
				buildStartTime = Date.now()

				if (!isFirstBuild) {
					console.log(`🔨 Rebuilding ${pkg.name}...`)
				}
			}
		})
	}

	if (child.stderr) {
		child.stderr.on("data", (data: Buffer) => {
			const error = data.toString()

			if (error.includes("error") || error.includes("Error")) {
				console.error(`❌ Build error in ${pkg.name}:`, error)
			}
		})
	}

	const sourcePath = path.resolve(__dirname, "..", pkg.sourcePath)

	const watchPath = pkg.npmPath ? path.join(sourcePath, pkg.npmPath, "dist") : path.join(sourcePath, "dist")

	let debounceTimer: ReturnType<typeof setTimeout> | null = null

	const watcher: FSWatcher | null = pathExists(watchPath)
		? watch(watchPath, { recursive: true }, (_eventType, _filename) => {
				if (debounceTimer) {
					clearTimeout(debounceTimer)
				}

				debounceTimer = setTimeout(() => {
					linkPackage(pkg, true) // Silent copy
					console.log(`📋 Copied updated ${pkg.name} files`)
				}, 500) // Wait 500ms after last change before copying.
			})
		: null

	if (!watcher && !pathExists(watchPath)) {
		console.log(`⏳ Waiting for initial build output...`)

		const checkInterval = setInterval(() => {
			if (pathExists(watchPath)) {
				clearInterval(checkInterval)
				console.log(`✅ Build output ready, watching for changes`)
				return startWatch(pkg)
			}
		}, 1000)
	}

	return { child, watcher }
}

function main(): void {
	if (unlink) {
		packages.forEach(unlinkPackage)
	} else {
		packages.forEach((pkg) => linkPackage(pkg, false))
	}

	if (unlink && packages.length > 0) {
		console.log("\n📦 Restoring npm packages...")

		try {
			execSync("pnpm install", { cwd: __dirname, stdio: "ignore" })
			console.log("✅ npm packages restored")
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`❌ Failed to restore packages: ${errorMessage}`)
			console.log("   Run 'pnpm install' manually if needed")
		}
	}

	if (!unlink && watchMode) {
		const packagesWithWatch = packages.filter(
			(pkg): pkg is PackageConfig & { watchCommand: string } => pkg.watchCommand !== undefined,
		)

		const watchers = packagesWithWatch.map(startWatch)

		if (watchers.length > 0) {
			process.on("SIGINT", () => {
				console.log("\n👋 Stopping watchers...")

				watchers.forEach((w) => {
					if (w.child) {
						w.child.kill()
					}

					if (w.watcher) {
						w.watcher.close()
					}
				})

				process.exit(0)
			})

			console.log("\n👀 Watching for changes (Ctrl+C to stop)\n")
		}
	}
}

main()
