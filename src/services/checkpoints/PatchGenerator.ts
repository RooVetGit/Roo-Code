import { glob } from "glob"
import { createPatch, applyPatch } from "diff"
import zlib from "zlib"
import util from "util"

const gzip = util.promisify(zlib.gzip)
const gunzip = util.promisify(zlib.gunzip)

/**
 * Patch file entry
 */
interface PatchFileEntry {
	type: "add" | "modify" | "delete"
	patch: string
	compressed: boolean
}

/**
 * Patch object
 */
export interface Patch {
	files: Record<string, PatchFileEntry>
	createdAt: number
}

/**
 * PatchGenerator handles generating and applying patches between file states
 */
export class PatchGenerator {
	/**
	 * Get all files in the workspace, respecting exclude patterns
	 */
	public async getWorkspaceFiles(workspaceDir: string, excludePatterns: string[]): Promise<string[]> {
		// Convert exclude patterns to glob ignore patterns
		const ignorePatterns = excludePatterns
			.map((pattern) => {
				// Remove trailing slash if present
				if (pattern.endsWith("/")) {
					pattern = pattern.slice(0, -1)
				}

				// Convert .gitignore style patterns to glob patterns
				if (pattern.startsWith("!")) {
					// Negated pattern - not supported in our simple implementation
					return null
				}

				return pattern
			})
			.filter(Boolean) as string[]

		// Use glob to find all files
		const files = await glob("**/*", {
			cwd: workspaceDir,
			absolute: true,
			nodir: true,
			ignore: ignorePatterns,
			dot: true,
		})

		return files
	}

	/**
	 * Generate a patch between two states
	 */
	public generatePatch(sourceState: Record<string, string>, targetState: Record<string, string>): Patch {
		const patch: Patch = {
			files: {},
			createdAt: Date.now(),
		}

		// Find modified and added files
		for (const [relativePath, targetContent] of Object.entries(targetState)) {
			const sourceContent = sourceState[relativePath]

			if (sourceContent === undefined) {
				// File was added
				patch.files[relativePath] = {
					type: "add",
					patch: targetContent,
					compressed: false,
				}
			} else if (sourceContent !== targetContent) {
				// File was modified
				const diffPatch = createPatch(relativePath, sourceContent, targetContent, "", "", { context: 3 })

				patch.files[relativePath] = {
					type: "modify",
					patch: diffPatch,
					compressed: false,
				}
			}
		}

		// Find deleted files
		for (const relativePath of Object.keys(sourceState)) {
			if (targetState[relativePath] === undefined) {
				// File was deleted
				patch.files[relativePath] = {
					type: "delete",
					patch: "",
					compressed: false,
				}
			}
		}

		return patch
	}

	/**
	 * Apply a patch to a state
	 */
	public applyPatch(state: Record<string, string>, patch: Patch): Record<string, string> {
		const newState = { ...state }

		for (const [relativePath, fileEntry] of Object.entries(patch.files)) {
			switch (fileEntry.type) {
				case "add":
					newState[relativePath] = fileEntry.patch
					break

				case "modify":
					const sourceContent = state[relativePath] || ""
					try {
						// Apply the diff patch
						const patchResult = applyPatch(sourceContent, fileEntry.patch, {
							fuzzFactor: 0,
						})

						if (typeof patchResult === "boolean") {
							// Patch failed
							throw new Error(`Failed to apply patch to ${relativePath}`)
						}

						newState[relativePath] = patchResult
					} catch (error) {
						console.error(`Error applying patch to ${relativePath}:`, error)
						// Keep the original content on error
						newState[relativePath] = sourceContent
					}
					break

				case "delete":
					delete newState[relativePath]
					break
			}
		}

		return newState
	}

	/**
	 * Compress a patch to reduce storage size
	 */
	public async compressPatch(patch: Patch): Promise<Patch> {
		const compressedPatch: Patch = {
			files: {},
			createdAt: patch.createdAt,
		}

		for (const [relativePath, fileEntry] of Object.entries(patch.files)) {
			if (fileEntry.compressed) {
				// Already compressed
				compressedPatch.files[relativePath] = fileEntry
				continue
			}

			if (fileEntry.type === "delete") {
				// No need to compress delete entries
				compressedPatch.files[relativePath] = fileEntry
				continue
			}

			try {
				const compressedData = await gzip(Buffer.from(fileEntry.patch, "utf-8"))

				compressedPatch.files[relativePath] = {
					type: fileEntry.type,
					patch: compressedData.toString("base64"),
					compressed: true,
				}
			} catch (error) {
				// If compression fails, use the original data
				compressedPatch.files[relativePath] = fileEntry
			}
		}

		return compressedPatch
	}

	/**
	 * Decompress a patch
	 */
	public async decompressPatch(patch: Patch): Promise<Patch> {
		const decompressedPatch: Patch = {
			files: {},
			createdAt: patch.createdAt,
		}

		for (const [relativePath, fileEntry] of Object.entries(patch.files)) {
			if (!fileEntry.compressed) {
				// Not compressed
				decompressedPatch.files[relativePath] = fileEntry
				continue
			}

			try {
				const compressedData = Buffer.from(fileEntry.patch, "base64")
				const decompressedData = await gunzip(compressedData)

				decompressedPatch.files[relativePath] = {
					type: fileEntry.type,
					patch: decompressedData.toString("utf-8"),
					compressed: false,
				}
			} catch (error) {
				// If decompression fails, use the original data
				console.error(`Error decompressing patch for ${relativePath}:`, error)
				decompressedPatch.files[relativePath] = {
					type: fileEntry.type,
					patch: "",
					compressed: false,
				}
			}
		}

		return decompressedPatch
	}
}
