import { globby, Options } from "globby"
import os from "os"
import * as path from "path"
import { arePathsEqual, getReadablePath } from "../../utils/path"
import { formatResponse } from "../../core/prompts/responses"
import { ClineSayTool } from "../../shared/ExtensionMessage"

export async function listFiles(dirPath: string, recursive: boolean, limit: number): Promise<[string[], boolean]> {
	const absolutePath = path.resolve(dirPath)
	// Do not allow listing files in root or home directory, which cline tends to want to do when the user's prompt is vague.
	const root = process.platform === "win32" ? path.parse(absolutePath).root : "/"
	const isRoot = arePathsEqual(absolutePath, root)
	if (isRoot) {
		return [[root], false]
	}
	const homeDir = os.homedir()
	const isHomeDir = arePathsEqual(absolutePath, homeDir)
	if (isHomeDir) {
		return [[homeDir], false]
	}

	const dirsToIgnore = [
		"node_modules",
		"__pycache__",
		"env",
		"venv",
		"target/dependency",
		"build/dependencies",
		"dist",
		"out",
		"bundle",
		"vendor",
		"tmp",
		"temp",
		"deps",
		"pkg",
		"Pods",
		".*", // '!**/.*' excludes hidden directories, while '!**/.*/**' excludes only their contents. This way we are at least aware of the existence of hidden directories.
	].map((dir) => `${dirPath}/**/${dir}/**`)

	const options = {
		cwd: dirPath,
		dot: true, // do not ignore hidden files/directories
		absolute: true,
		markDirectories: true, // Append a / on any directories matched (/ is used on windows as well, so dont use path.sep)
		gitignore: recursive, // globby ignores any files that are gitignored
		ignore: recursive ? dirsToIgnore : undefined, // just in case there is no gitignore, we ignore sensible defaults
		onlyFiles: false, // true by default, false means it will list directories on their own too
	}
	// * globs all files in one dir, ** globs files in nested directories
	const files = recursive ? await globbyLevelByLevel(limit, options) : (await globby("*", options)).slice(0, limit)
	return [files, files.length >= limit]
}

/*
Breadth-first traversal of directory structure level by level up to a limit:
   - Queue-based approach ensures proper breadth-first traversal
   - Processes directory patterns level by level
   - Captures a representative sample of the directory structure up to the limit
   - Minimizes risk of missing deeply nested files

- Notes:
   - Relies on globby to mark directories with /
   - Potential for loops if symbolic links reference back to parent (we could use followSymlinks: false but that may not be ideal for some projects and it's pointless if they're not using symlinks wrong)
   - Timeout mechanism prevents infinite loops
*/
async function globbyLevelByLevel(limit: number, options?: Options) {
	let results: Set<string> = new Set()
	let queue: string[] = ["*"]

	const globbingProcess = async () => {
		while (queue.length > 0 && results.size < limit) {
			const pattern = queue.shift()!
			const filesAtLevel = await globby(pattern, options)

			for (const file of filesAtLevel) {
				if (results.size >= limit) {
					break
				}
				results.add(file)
				if (file.endsWith("/")) {
					queue.push(`${file}*`)
				}
			}
		}
		return Array.from(results).slice(0, limit)
	}

	// Timeout after 10 seconds and return partial results
	const timeoutPromise = new Promise<string[]>((_, reject) => {
		setTimeout(() => reject(new Error("Globbing timeout")), 10_000)
	})
	try {
		return await Promise.race([globbingProcess(), timeoutPromise])
	} catch (error) {
		console.warn("Globbing timed out, returning partial results")
		return Array.from(results)
	}
}

export class ListFilesTool {
	private readonly cwd: string
	private readonly relDirPath: string
	private readonly recursive: boolean
	private readonly providerRef: WeakRef<any>
	private readonly rooIgnoreController: any

	constructor(
		cwd: string,
		relDirPath: string,
		recursive: boolean,
		providerRef: WeakRef<any>,
		rooIgnoreController: any,
	) {
		this.cwd = cwd
		this.relDirPath = relDirPath
		this.recursive = recursive
		this.providerRef = providerRef
		this.rooIgnoreController = rooIgnoreController
	}

	public getSharedMessageProps(): ClineSayTool {
		return {
			tool: !this.recursive ? "listFilesTopLevel" : "listFilesRecursive",
			path: getReadablePath(this.cwd, removeClosingTag("path", this.relDirPath)),
		}
	}

	public async getPartialMessage(): Promise<string> {
		return JSON.stringify({
			...this.getSharedMessageProps(),
			content: "",
		} satisfies ClineSayTool)
	}

	public async execute(): Promise<string> {
		if (!this.relDirPath) {
			throw new Error("Missing required parameter: path")
		}

		const absolutePath = path.resolve(this.cwd, this.relDirPath)
		const [files, didHitLimit] = await listFiles(absolutePath, this.recursive, 200)
		const { showRooIgnoredFiles = true } = (await this.providerRef.deref()?.getState()) ?? {}

		return formatResponse.formatFilesList(
			absolutePath,
			files,
			didHitLimit,
			this.rooIgnoreController,
			showRooIgnoredFiles,
		)
	}
}
function removeClosingTag(arg0: string, relDirPath: string): string | undefined {
	throw new Error("Function not implemented.")
}

export class ListFilesToolHandler {
	constructor(
		private readonly cline: any, // Type this properly based on your Cline class
		private readonly block: {
			params: { path?: string; recursive?: string }
			partial?: boolean
		},
		private readonly pushToolResult: (result: string) => void,
	) {}

	async handle(): Promise<void> {
		const relDirPath = this.block.params.path
		const recursiveRaw = this.block.params.recursive
		const recursive = recursiveRaw?.toLowerCase() === "true"

		const listFilesTool = new ListFilesTool(
			this.cline.cwd,
			relDirPath,
			recursive,
			this.cline.providerRef,
			this.cline.rooIgnoreController,
		)

		try {
			if (this.block.partial) {
				await this.handlePartial(listFilesTool)
				return
			}

			if (!relDirPath) {
				this.cline.consecutiveMistakeCount++
				this.pushToolResult(await this.cline.sayAndCreateMissingParamError("list_files", "path"))
				return
			}

			await this.handleComplete(listFilesTool)
		} catch (error) {
			await this.cline.handleError("listing files", error)
		}
	}

	private async handlePartial(listFilesTool: ListFilesTool): Promise<void> {
		const partialMessage = await listFilesTool.getPartialMessage()
		await this.cline.ask("tool", partialMessage, this.block.partial).catch(() => {})
	}

	private async handleComplete(listFilesTool: ListFilesTool): Promise<void> {
		this.cline.consecutiveMistakeCount = 0
		const result = await listFilesTool.execute()

		const completeMessage = JSON.stringify({
			...listFilesTool.getSharedMessageProps(),
			content: result,
		} satisfies ClineSayTool)

		const didApprove = await this.cline.askApproval("tool", completeMessage)
		if (!didApprove) {
			return
		}

		this.pushToolResult(result)
	}
}
