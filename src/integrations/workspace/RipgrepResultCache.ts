import { spawn } from "child_process"
import { dirname, resolve as pathResolve, relative, sep } from "path"

// Simplified tree structure - files represented by true, directories by nested objects
export type SimpleTreeNode = {
	[key: string]: true | SimpleTreeNode
}

/**
 * Ripgrep result cache class
 * Provides file tree caching functionality with incremental updates
 */
export class RipgrepResultCache {
	private rgPath: string
	private _targetPath: string
	private cachedTree: SimpleTreeNode | null = null
	private invalidatedDirectories = new Set<string>()
	private rgArgs: string[]
	private currentBuildPromise: Promise<SimpleTreeNode> | null = null
	private fileLimit: number

	constructor(rgPath: string, targetPath: string, rgArgs: string[] = [], fileLimit: number = 5000) {
		this.rgPath = rgPath
		this._targetPath = pathResolve(targetPath)
		this.fileLimit = fileLimit
		this.rgArgs = rgArgs.length > 0 ? rgArgs : ["--files"]
	}

	get targetPath(): string {
		return this._targetPath
	}

	/**
	 * Asynchronously get file tree
	 * - If there's valid cache and no invalid directories, return cache
	 * - If currently building, wait for current build result
	 * - Otherwise trigger new build
	 */
	async getTree(): Promise<SimpleTreeNode> {
		// If there's valid cache, return directly
		if (this.cachedTree && this.invalidatedDirectories.size === 0) {
			return this.cachedTree
		}

		// If already building, wait for current build result
		if (this.currentBuildPromise) {
			return this.currentBuildPromise
		}

		// Start new build
		try {
			this.currentBuildPromise = this.buildTree()
			const result = await this.currentBuildPromise
			return result
		} finally {
			// Clear Promise cache after build completion
			this.currentBuildPromise = null
		}
	}

	/**
	 * Internal method: build or update tree
	 */
	private async buildTree(): Promise<SimpleTreeNode> {
		try {
			if (this.cachedTree && this.invalidatedDirectories.size > 0) {
				// Has cache but has invalid directories, perform incremental update
				await this.updateInvalidatedDirectories()
			} else {
				// No cache, complete rebuild
				this.cachedTree = await this.buildTreeStreaming()
			}

			// Clear invalid directory markers
			this.invalidatedDirectories.clear()
			return this.cachedTree
		} catch (error) {
			// Clear cache state on error
			this.cachedTree = null
			this.invalidatedDirectories.clear()
			throw error
		}
	}

	/**
	 * Called when file is added
	 * Mark parent directory as invalid and remove corresponding subtree from tree
	 */
	fileAdded(filePath: string): void {
		this.fileAddedOrRemoved(filePath)
	}

	/**
	 * Called when file is removed
	 * Mark parent directory as invalid and remove corresponding subtree from tree
	 */
	fileRemoved(filePath: string): void {
		this.fileAddedOrRemoved(filePath)
	}

	private fileAddedOrRemoved(filePath: string): void {
		const relativePath = relative(this._targetPath, pathResolve(this._targetPath, filePath))
		const parentDir = dirname(relativePath)

		if (parentDir !== "." && parentDir !== "") {
			this.invalidateDirectory(parentDir)
		}
	}

	/**
	 * Mark directory as invalid
	 * Check containment relationship with existing invalid directories to avoid duplicate marking
	 */
	private invalidateDirectory(dirPath: string): void {
		if (!this.cachedTree) {
			return
		}

		const normalizedPath = dirPath.replace(/\\/g, "/")

		// Check if already contained by larger scope invalid directory
		for (const invalidDir of this.invalidatedDirectories) {
			if (normalizedPath.startsWith(invalidDir + "/") || normalizedPath === invalidDir) {
				// Current directory already contained in invalid directory, no need to mark again
				return
			}
		}

		// Remove existing invalid directories contained by current directory
		const toRemove: string[] = []
		for (const invalidDir of this.invalidatedDirectories) {
			if (invalidDir.startsWith(normalizedPath + "/")) {
				toRemove.push(invalidDir)
			}
		}

		// Remove contained invalid directories
		for (const dir of toRemove) {
			this.invalidatedDirectories.delete(dir)
		}

		// Mark current directory as invalid
		this.invalidatedDirectories.add(normalizedPath)

		// Remove corresponding subtree from cache tree
		this.removeDirectoryFromTree(normalizedPath)
	}

	/**
	 * Remove specified directory subtree from simplified tree
	 */
	private removeDirectoryFromTree(dirPath: string): void {
		if (!this.cachedTree) {
			return
		}

		const pathParts = dirPath.split("/").filter(Boolean)
		this.removeNodeByPath(this.cachedTree, pathParts, 0)
	}

	/**
	 * Recursively remove simplified tree node
	 */
	private removeNodeByPath(tree: SimpleTreeNode, pathParts: string[], depth: number): boolean {
		if (depth >= pathParts.length) {
			return false
		}

		const currentPart = pathParts[depth]

		if (!(currentPart in tree)) {
			return false
		}

		if (depth === pathParts.length - 1) {
			// Found target node, remove it
			delete tree[currentPart]
			return true
		}

		// Continue searching in child nodes
		const childNode = tree[currentPart]
		if (childNode !== true && typeof childNode === "object") {
			const removed = this.removeNodeByPath(childNode, pathParts, depth + 1)

			// If child node is removed and current node is empty object, remove current node
			if (removed && Object.keys(childNode).length === 0) {
				delete tree[currentPart]
				return true
			}
		}

		return false
	}

	/**
	 * Update directories marked as invalid
	 * Use ripgrep's multi-path support to update all invalid directories at once
	 */
	private async updateInvalidatedDirectories(): Promise<void> {
		if (this.invalidatedDirectories.size === 0) {
			return
		}

		try {
			// Stream build subtrees for all invalid directories (pass directory paths directly)
			const invalidDirectories = Array.from(this.invalidatedDirectories).map((dir) => dir.split("/").join(sep))
			const subtree = await this.buildTreeStreaming(invalidDirectories)

			// Merge subtrees into main tree (replace original invalid parts)
			this.mergeInvalidatedSubtrees(subtree)
		} catch (error) {
			console.warn("Error updating invalid directories:", error)
			// If incremental update fails, fallback to complete rebuild
			this.cachedTree = await this.buildTreeStreaming()
		}
	}

	/**
	 * Unified streaming tree building method (simplified version, builds SimpleTreeNode)
	 * @param targetPaths Array of target paths to scan, scans entire targetPath when empty
	 */
	private async buildTreeStreaming(targetPaths: string[] = []): Promise<SimpleTreeNode> {
		return new Promise((resolve, reject) => {
			// Build ripgrep arguments
			const args = [...this.rgArgs]

			// If target paths specified, use relative paths directly (ripgrep supports multiple paths)
			if (targetPaths.length > 0) {
				args.push(...targetPaths)
			}

			const child = spawn(this.rgPath, args, {
				cwd: this._targetPath,
				stdio: ["pipe", "pipe", "pipe"],
			})

			const tree: SimpleTreeNode = {}
			let buffer = ""
			let fileCount = 0

			// Stream add file paths to simplified tree structure
			const addFileToTree = (filePath: string) => {
				// ripgrep output is already relative path, use directly
				const parts = filePath.split(sep).filter(Boolean)
				let currentNode: SimpleTreeNode = tree

				for (let i = 0; i < parts.length; i++) {
					const part = parts[i]
					const isFile = i === parts.length - 1 // Last part is file

					if (isFile) {
						// Files represented by true
						currentNode[part] = true
						fileCount++

						// Check if file limit reached
						if (fileCount >= this.fileLimit) {
							child.kill()
							return true // Indicate limit reached
						}
					} else {
						// Directories represented by nested objects
						if (!currentNode[part] || currentNode[part] === true) {
							currentNode[part] = {}
						}
						currentNode = currentNode[part] as SimpleTreeNode
					}
				}
				return false // Limit not reached
			}

			child.stdout.on("data", (data: Buffer) => {
				buffer += data.toString()
				const lines = buffer.split("\n")
				buffer = lines.pop() || ""

				for (const line of lines) {
					const trimmedLine = line.trim()
					if (trimmedLine) {
						const limitReached = addFileToTree(trimmedLine)
						if (limitReached) {
							break
						}
					}
				}
			})

			let errorOutput = ""

			child.stderr.on("data", (data: Buffer) => {
				errorOutput += data.toString()
			})

			child.on("close", (code: number | null) => {
				// Process final buffer content
				if (buffer.trim() && fileCount < this.fileLimit) {
					addFileToTree(buffer.trim())
				}

				if (errorOutput && Object.keys(tree).length === 0) {
					reject(new Error(`ripgrep process error: ${errorOutput}`))
				} else {
					resolve(tree)
				}
			})

			child.on("error", (error: Error) => {
				reject(error)
			})
		})
	}

	/**
	 * Merge invalidated subtrees into main tree
	 * subtree already contains complete content of all invalid directories, merge directly
	 */
	private mergeInvalidatedSubtrees(subtree: SimpleTreeNode): void {
		if (!this.cachedTree) {
			this.cachedTree = subtree
			return
		}

		// Modify original object directly to avoid new object creation overhead
		this.mergeSimpleTreeNodesInPlace(this.cachedTree, subtree)
	}

	/**
	 * In-place merge two simplified tree nodes (optimized version, reduces object creation)
	 * Uses Object.hasOwn for safe property checks to prevent prototype pollution
	 */
	private mergeSimpleTreeNodesInPlace(existing: SimpleTreeNode, newTree: SimpleTreeNode): void {
		for (const key of Object.keys(newTree)) {
			// skip inherited properties
			if (!Object.hasOwn(newTree, key)) {
				continue
			}

			// skip dangerous property names
			if (key === "__proto__" || key === "constructor" || key === "prototype") {
				continue
			}

			const value = newTree[key]
			if (value === true) {
				existing[key] = true
			} else {
				if (!existing[key] || existing[key] === true) {
					existing[key] = value
				} else {
					this.mergeSimpleTreeNodesInPlace(existing[key] as SimpleTreeNode, value)
				}
			}
		}
	}

	/**
	 * Clear cache
	 */
	clearCache(): void {
		this.cachedTree = null
		this.invalidatedDirectories.clear()
		this.currentBuildPromise = null
	}
}
