import * as vscode from "vscode"
import * as path from "path"

import { listFiles } from "../../services/glob/list-files"
import { ClineProvider } from "../../core/webview/ClineProvider"
import { toRelativePath, getWorkspacePath } from "../../utils/path"
import { RipgrepResultCache, SimpleTreeNode } from "./RipgrepResultCache"
import { getBinPath } from "../../services/ripgrep"
import { FileResult } from "../../services/search/file-search"

const MAX_INITIAL_FILES = 1_000

// Note: this is not a drop-in replacement for listFiles at the start of tasks, since that will be done for Desktops when there is no workspace selected
class WorkspaceTracker {
	private providerRef: WeakRef<ClineProvider>
	private disposables: vscode.Disposable[] = []
	private filePaths: Set<string> = new Set()
	private updateTimer: NodeJS.Timeout | null = null
	private prevWorkSpacePath: string | undefined
	private resetTimer: NodeJS.Timeout | null = null

	// RipgrepResultCache related properties
	private ripgrepCache: RipgrepResultCache | null = null
	private cachedRipgrepPath: string | null = null

	get cwd() {
		return getWorkspacePath()
	}

	constructor(provider: ClineProvider) {
		this.providerRef = new WeakRef(provider)
		this.registerListeners()
	}

	private getRipgrepFileLimit(): number {
		const config = vscode.workspace.getConfiguration("roo-cline")
		return Math.max(5000, config.get<number>("maximumIndexedFilesForFileSearch", 200000))
	}

	private DIRS_IGNORED_BY_RIPGREP = ["node_modules", ".git", "out", "dist"]
	/**
	 * Get complete ripgrep arguments based on VSCode search configuration
	 */
	private getRipgrepArgs(): string[] {
		const config = vscode.workspace.getConfiguration("search")
		const args: string[] = ["--files", "--follow", "--hidden"]

		const useIgnoreFiles = config.get<boolean>("useIgnoreFiles", true)

		if (!useIgnoreFiles) {
			args.push("--no-ignore")
		} else {
			const useGlobalIgnoreFiles = config.get<boolean>("useGlobalIgnoreFiles", true)
			const useParentIgnoreFiles = config.get<boolean>("useParentIgnoreFiles", true)

			if (!useGlobalIgnoreFiles) {
				args.push("--no-ignore-global")
			}

			if (!useParentIgnoreFiles) {
				args.push("--no-ignore-parent")
			}
		}

		// Add default exclude patterns
		for (const dir of this.DIRS_IGNORED_BY_RIPGREP) {
			args.push("-g", `!**/${dir}/**`)
		}
		return args
	}

	private isPathIgnoredByRipgrep(filePath: string): boolean {
		const normalizedPath = filePath.replace(/\\/g, "/")
		for (const dir of this.DIRS_IGNORED_BY_RIPGREP) {
			// Check if the directory appears in the path
			if (normalizedPath.includes(`/${dir}/`)) {
				return true
			}
		}
		return false
	}

	/**
	 * Get comprehensive file tree using RipgrepResultCache
	 * This provides a more complete and efficient file structure than the limited filePaths set
	 */
	async getRipgrepFileTree(): Promise<SimpleTreeNode> {
		const currentWorkspacePath = this.cwd

		if (!currentWorkspacePath) {
			return {}
		}

		// Check if we need to recreate the cache
		await this.ensureRipgrepCache()

		if (!this.ripgrepCache) {
			return {}
		}

		try {
			return await this.ripgrepCache.getTree()
		} catch (error) {
			return {}
		}
	}

	async getRipgrepFileList(): Promise<FileResult[]> {
		const tree = await this.getRipgrepFileTree()
		return this.treeToFileResults(tree)
	}

	/**
	 * Convert SimpleTreeNode to FileResult array
	 */
	private treeToFileResults(tree: SimpleTreeNode): FileResult[] {
		const result: FileResult[] = []
		const stack: [SimpleTreeNode, string][] = [[tree, ""]]

		while (stack.length > 0) {
			const [node, currentPath] = stack.pop()!
			for (const key in node) {
				const value = node[key]
				const fullPath = currentPath ? `${currentPath}/${key}` : key

				if (value === true) {
					result.push({ path: fullPath, type: "file" })
				} else {
					result.push({ path: fullPath, type: "folder" })
					stack.push([value as SimpleTreeNode, fullPath])
				}
			}
		}

		return result
	}

	/**
	 * Ensure RipgrepResultCache is properly initialized
	 */
	private async ensureRipgrepCache(): Promise<void> {
		const currentWorkspacePath = this.cwd
		if (!currentWorkspacePath) {
			return
		}

		const currentRipgrepPath = await this.getRipgrepPath()

		if (!this.ripgrepCache || this.ripgrepCache.targetPath !== currentWorkspacePath) {
			this.ripgrepCache = new RipgrepResultCache(
				currentRipgrepPath,
				currentWorkspacePath,
				this.getRipgrepArgs(),
				this.getRipgrepFileLimit(),
			)
		}
	}

	/**
	 * Get ripgrep binary path with caching
	 */
	private async getRipgrepPath(): Promise<string> {
		if (!this.cachedRipgrepPath) {
			const rgPath = await getBinPath(vscode.env.appRoot)
			if (!rgPath) {
				throw new Error("Could not find ripgrep binary")
			}
			this.cachedRipgrepPath = rgPath
		}
		return this.cachedRipgrepPath
	}

	/**
	 * Helper method to compare arrays
	 */
	private arraysEqual(a: string[] | null, b: string[]): boolean {
		if (!a) return false
		return a.length === b.length && a.every((val, i) => val === b[i])
	}

	async initializeFilePaths() {
		// should not auto get filepaths for desktop since it would immediately show permission popup before cline ever creates a file
		if (!this.cwd) {
			return
		}
		const tempCwd = this.cwd
		const [files, _] = await listFiles(tempCwd, true, MAX_INITIAL_FILES)
		if (this.prevWorkSpacePath !== tempCwd) {
			return
		}
		files.slice(0, MAX_INITIAL_FILES).forEach((file) => this.filePaths.add(this.normalizeFilePath(file)))
		this.workspaceDidUpdate()

		// preheat file tree
		this.getRipgrepFileTree()
	}

	private registerListeners() {
		const watcher = vscode.workspace.createFileSystemWatcher("**")
		this.prevWorkSpacePath = this.cwd
		this.disposables.push(
			watcher.onDidCreate(async (uri) => {
				const fsPath = uri.fsPath
				if (this.ripgrepCache) {
					if (!this.isPathIgnoredByRipgrep(fsPath)) {
						this.ripgrepCache.fileAdded(fsPath)
					}
				}
				await this.addFilePath(fsPath)
				this.workspaceDidUpdate()
			}),
		)

		// Renaming files triggers a delete and create event
		this.disposables.push(
			watcher.onDidDelete(async (uri) => {
				const fsPath = uri.fsPath
				if (this.ripgrepCache) {
					if (!this.isPathIgnoredByRipgrep(fsPath)) {
						this.ripgrepCache.fileRemoved(fsPath)
					}
				}
				if (await this.removeFilePath(fsPath)) {
					this.workspaceDidUpdate()
				}
			}),
		)

		this.disposables.push(watcher)

		// Listen for tab changes and call workspaceDidUpdate directly
		this.disposables.push(
			vscode.window.tabGroups.onDidChangeTabs(() => {
				// Reset if workspace path has changed
				if (this.prevWorkSpacePath !== this.cwd) {
					this.workspaceDidReset()
				} else {
					// Otherwise just update
					this.workspaceDidUpdate()
				}
			}),
		)

		// Listen for VSCode configuration changes
		this.disposables.push(
			vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
				// Clear cache when search-related configuration changes
				if (
					event.affectsConfiguration("search.useIgnoreFiles") ||
					event.affectsConfiguration("search.useGlobalIgnoreFiles") ||
					event.affectsConfiguration("search.useParentIgnoreFiles") ||
					event.affectsConfiguration("roo-cline.maximumIndexedFilesForFileSearch")
				) {
					this.ripgrepCache = null
				}
			}),
		)
	}

	private getOpenedTabsInfo() {
		return vscode.window.tabGroups.all.reduce(
			(acc, group) => {
				const groupTabs = group.tabs
					.filter((tab) => tab.input instanceof vscode.TabInputText)
					.map((tab) => ({
						label: tab.label,
						isActive: tab.isActive,
						path: toRelativePath((tab.input as vscode.TabInputText).uri.fsPath, this.cwd || ""),
					}))

				groupTabs.forEach((tab) => (tab.isActive ? acc.unshift(tab) : acc.push(tab)))
				return acc
			},
			[] as Array<{ label: string; isActive: boolean; path: string }>,
		)
	}

	private async workspaceDidReset() {
		if (this.resetTimer) {
			clearTimeout(this.resetTimer)
		}
		this.resetTimer = setTimeout(async () => {
			if (this.prevWorkSpacePath !== this.cwd) {
				// Clear cache when workspace changes
				this.ripgrepCache = null
				await this.providerRef.deref()?.postMessageToWebview({
					type: "workspaceUpdated",
					filePaths: [],
					openedTabs: this.getOpenedTabsInfo(),
				})
				this.filePaths.clear()
				this.prevWorkSpacePath = this.cwd
				this.initializeFilePaths()
			}
		}, 300) // Debounce for 300ms
	}

	private workspaceDidUpdate() {
		if (this.updateTimer) {
			clearTimeout(this.updateTimer)
		}
		this.updateTimer = setTimeout(() => {
			if (!this.cwd) {
				return
			}

			const relativeFilePaths = Array.from(this.filePaths).map((file) => toRelativePath(file, this.cwd))
			this.providerRef.deref()?.postMessageToWebview({
				type: "workspaceUpdated",
				filePaths: relativeFilePaths,
				openedTabs: this.getOpenedTabsInfo(),
			})
			this.updateTimer = null
		}, 300) // Debounce for 300ms
	}

	private normalizeFilePath(filePath: string): string {
		const resolvedPath = this.cwd ? path.resolve(this.cwd, filePath) : path.resolve(filePath)
		return filePath.endsWith("/") ? resolvedPath + "/" : resolvedPath
	}

	private async addFilePath(filePath: string): Promise<string> {
		// Allow for some buffer to account for files being created/deleted during a task
		if (this.filePaths.size >= MAX_INITIAL_FILES * 2) {
			return filePath
		}

		const normalizedPath = this.normalizeFilePath(filePath)
		try {
			const stat = await vscode.workspace.fs.stat(vscode.Uri.file(normalizedPath))
			const isDirectory = (stat.type & vscode.FileType.Directory) !== 0
			const pathWithSlash = isDirectory && !normalizedPath.endsWith("/") ? normalizedPath + "/" : normalizedPath
			this.filePaths.add(pathWithSlash)
			return pathWithSlash
		} catch {
			// If stat fails, assume it's a file (this can happen for newly created files)
			this.filePaths.add(normalizedPath)
			return normalizedPath
		}
	}

	private async removeFilePath(filePath: string): Promise<boolean> {
		const normalizedPath = this.normalizeFilePath(filePath)
		return this.filePaths.delete(normalizedPath) || this.filePaths.delete(normalizedPath + "/")
	}

	public dispose() {
		if (this.updateTimer) {
			clearTimeout(this.updateTimer)
			this.updateTimer = null
		}
		if (this.resetTimer) {
			clearTimeout(this.resetTimer)
			this.resetTimer = null
		}
		this.disposables.forEach((d) => d.dispose())
		this.disposables = [] // Clear the array
	}
}

export default WorkspaceTracker
