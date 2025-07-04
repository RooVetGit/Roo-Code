// Worker-compatible version of RooIgnoreController without vscode dependencies
import * as fs from "fs/promises"
import * as path from "path"
import ignore, { Ignore } from "ignore"

/**
 * Worker-compatible controller for managing .rooignore files
 */
export class RooIgnoreController {
	private ignoreInstance: Ignore
	private rooIgnorePath: string
	private initialized = false

	constructor(private workspacePath: string) {
		if (!workspacePath || workspacePath.trim() === "") {
			throw new Error("Workspace path cannot be empty")
		}
		this.rooIgnorePath = path.join(workspacePath, ".rooignore")
		this.ignoreInstance = ignore()
	}

	/**
	 * Initialize the controller by loading .rooignore patterns
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return
		}

		try {
			const content = await fs.readFile(this.rooIgnorePath, "utf8")
			const patterns = content
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith("#"))

			this.ignoreInstance.add(patterns)
			this.initialized = true
		} catch (error) {
			// If .rooignore doesn't exist, that's fine - no patterns to add
			this.initialized = true
		}
	}

	/**
	 * Check if a path should be ignored
	 */
	isIgnored(filePath: string): boolean {
		if (!this.initialized) {
			throw new Error("RooIgnoreController not initialized. Call initialize() first.")
		}

		const relativePath = path.relative(this.workspacePath, filePath)
		return relativePath ? this.ignoreInstance.ignores(relativePath) : false
	}

	/**
	 * Filter an array of paths, removing ignored ones
	 */
	filterPaths(paths: string[]): string[] {
		if (!this.initialized) {
			throw new Error("RooIgnoreController not initialized. Call initialize() first.")
		}

		return paths.filter((filePath) => {
			const relativePath = path.relative(this.workspacePath, filePath)
			return relativePath ? !this.ignoreInstance.ignores(relativePath) : true
		})
	}

	/**
	 * Add patterns to the ignore list
	 */
	addPatterns(patterns: string[]): void {
		this.ignoreInstance.add(patterns)
	}

	/**
	 * Get the current ignore instance
	 */
	getIgnoreInstance(): Ignore {
		return this.ignoreInstance
	}

	/**
	 * Reload patterns from the .rooignore file
	 */
	async reload(): Promise<void> {
		this.ignoreInstance = ignore()
		this.initialized = false
		await this.initialize()
	}
}
