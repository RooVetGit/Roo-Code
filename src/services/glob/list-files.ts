import { globby, Options as GlobbyOptions } from "globby"
import os from "os"
import * as path from "path"
import * as fs from "fs"
import { arePathsEqual } from "../../utils/path"
import { DirectoryNode, FileNode, FileSystemNode, ListFilesOptions, ListFilesResult, TreeResult } from "./types"


// Get ignore patterns from .clineignore and add default patterns
function getIgnorePatterns(dirPath: string): string[] {
	const defaultIgnores = [".git/**"]
	try {
		const clineignorePath = path.join(dirPath, ".clineignore")
		const clineignorePatterns = fs
			.readFileSync(clineignorePath, "utf8")
			.split("\n")
			.filter((line) => line && !line.startsWith("#"))
			.map((pattern) => pattern.trim())
			.filter(Boolean)
		return [...defaultIgnores, ...clineignorePatterns]
	} catch {
		console.warn("No .clineignore file found, proceeding with default ignore patterns")
		return defaultIgnores
	}
}

// Helper function to create globby options
function createGlobbyOptions(dirPath: string, recursive: boolean): GlobbyOptions {
	return {
		cwd: dirPath,
		dot: true,
		absolute: true,
		markDirectories: true,
		gitignore: true, // Always respect .gitignore
		ignore: getIgnorePatterns(dirPath), // Always respect .clineignore
		onlyFiles: false,
	}
}

// Helper function to check if path is restricted
function isRestrictedPath(absolutePath: string): [boolean, string[]] {
	const root = process.platform === "win32" ? path.parse(absolutePath).root : "/"
	if (arePathsEqual(absolutePath, root)) {
		return [true, [root]]
	}
	const homeDir = os.homedir()
	if (arePathsEqual(absolutePath, homeDir)) {
		return [true, [homeDir]]
	}
	return [false, []]
}

// Main listFiles function
export async function listFiles<T extends "flat" | "tree">(
	dirPath: string,
	options: Omit<ListFilesOptions, "format"> & { format: T },
): Promise<ListFilesResult<T>> {
	try {
		const stats = await fs.promises.stat(dirPath)
		if (!stats.isDirectory()) {
			throw new Error(`Path is not a directory: ${dirPath}`)
		}
	} catch (error) {
		if (error.code === "ENOENT") {
			throw new Error(`Directory does not exist: ${dirPath}`)
		}
		throw new Error(`Cannot access directory: ${error.message}`)
	}

	const absolutePath = path.resolve(dirPath)
	const [isRestricted, restrictedResult] = isRestrictedPath(absolutePath)
	if (isRestricted) {
		return [restrictedResult, false] as ListFilesResult<T>
	}

	const globbyOpts = createGlobbyOptions(dirPath, options.recursive ?? false)

	if (options.format === "flat") {
		const files = options.recursive
			? await globbyLevelByLevel(options.limit, globbyOpts)
			: (await globby("*", globbyOpts)).slice(0, options.limit)
		return [files, files.length >= options.limit] as ListFilesResult<T>
	}

	const files = await globbyLevelByLevel(options.limit, globbyOpts)
	const didHitLimit = files.length >= options.limit
	const treeResult = buildTreeFromPaths(absolutePath, files)
	return [{ root: treeResult.root, hasMore: didHitLimit }, didHitLimit] as ListFilesResult<T>
}

function buildTreeFromPaths(basePath: string, paths: string[]): TreeResult {
	const root: DirectoryNode = {
		name: path.basename(basePath),
		type: "directory",
		children: {},
	}

	for (const filePath of paths) {
		const relativePath = path.relative(basePath, filePath)
		const segments = relativePath.split(path.sep).filter(Boolean)

		let current = root
		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i]
			const isLast = i === segments.length - 1

			if (isLast && !filePath.endsWith("/")) {
				const parsed = path.parse(segment)
				current.children[segment] = {
					name: parsed.name,
					type: "file",
					extension: parsed.ext,
				}
				continue
			}

			// If we get here, we need a directory node
			current.children[segment] ??= {
				name: segment,
				type: "directory",
				children: {},
			}
			current = current.children[segment] as DirectoryNode
		}
	}

	return { root, hasMore: false }
}

async function globbyLevelByLevel(limit: number, options: GlobbyOptions): Promise<string[]> {
	const results: Set<string> = new Set()
	const queue: string[] = ["*"]
	const errors: Set<string> = new Set()

	const globbingProcess = async () => {
		while (queue.length > 0 && results.size < limit) {
			const pattern = queue.shift()!

			try {
				const filesAtLevel = await globby(pattern, options)
				for (const file of filesAtLevel) {
					if (results.size >= limit) break

					try {
						await fs.promises.access(file, fs.constants.R_OK)
						results.add(file)

						if (file.endsWith("/")) {
							queue.push(`${file}*`)
						}
					} catch (accessError) {
						errors.add(`Access denied: ${file}`)
					}
				}
			} catch (error) {
				if (error.code === "EACCES") {
					errors.add(`Permission denied: ${pattern}`)
					continue
				}
				throw error
			}
		}

		if (errors.size > 0) {
			console.warn("Permission errors encountered:", Array.from(errors).join("\n"))
		}

		return Array.from(results).slice(0, limit)
	}

	const timeoutPromise = new Promise<string[]>((_, reject) => {
		setTimeout(() => reject(new Error("Globbing timeout")), 10_000)
	})

	try {
		return await Promise.race([globbingProcess(), timeoutPromise])
	} catch (error) {
		if (error.message === "Globbing timeout") {
			if (errors.size > 0) {
				console.warn("Permission errors encountered:", Array.from(errors).join("\n"))
			}
			return Array.from(results)
		}
		throw error
	}
}

export type { FileNode, DirectoryNode, FileSystemNode, TreeResult, ListFilesOptions, ListFilesResult }
