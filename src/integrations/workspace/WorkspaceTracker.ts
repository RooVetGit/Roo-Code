import * as vscode from "vscode"
import * as path from "path"

import { listFiles } from "../../services/glob/list-files"
import { ClineProvider } from "../../core/webview/ClineProvider"
import { toRelativePath, getWorkspacePath } from "../../utils/path"
import { executeRipgrepForFiles, FileResult } from "../../services/search/file-search"
import { isPathInIgnoredDirectory } from "../../services/glob/ignore-utils"

const MAX_INITIAL_FILES = 1_000

// Note: this is not a drop-in replacement for listFiles at the start of tasks, since that will be done for Desktops when there is no workspace selected
class WorkspaceTracker {
	private providerRef: WeakRef<ClineProvider>
	private disposables: vscode.Disposable[] = []
	private filePaths: Set<string> = new Set()
	private updateTimer: NodeJS.Timeout | null = null
	private prevWorkSpacePath: string | undefined
	private resetTimer: NodeJS.Timeout | null = null

	// Ripgrep cache related properties
	private ripgrepFileCache: FileResult[] | null = null
	private ripgrepCacheWorkspacePath: string | undefined = undefined
	private ripgrepOperationPromise: Promise<FileResult[]> | null = null

	get cwd() {
		return getWorkspacePath()
	}

	constructor(provider: ClineProvider) {
		this.providerRef = new WeakRef(provider)
		this.registerListeners()
	}

	/**
	 * Get ripgrep extra options based on VSCode search configuration
	 */
	private getRipgrepExtraOptions(): string[] {
		const config = vscode.workspace.getConfiguration("search")
		const extraOptions: string[] = []

		const useIgnoreFiles = config.get<boolean>("useIgnoreFiles", true)

		if (!useIgnoreFiles) {
			extraOptions.push("--no-ignore")
		} else {
			const useGlobalIgnoreFiles = config.get<boolean>("useGlobalIgnoreFiles", true)
			const useParentIgnoreFiles = config.get<boolean>("useParentIgnoreFiles", true)

			if (!useGlobalIgnoreFiles) {
				extraOptions.push("--no-ignore-global")
			}

			if (!useParentIgnoreFiles) {
				extraOptions.push("--no-ignore-parent")
			}
		}

		return extraOptions
	}

	/**
	 * Get comprehensive file list using ripgrep with caching
	 * This provides a more complete file list than the limited filePaths set
	 */
	async getRipgrepFileList(): Promise<FileResult[]> {
		const currentWorkspacePath = this.cwd

		if (!currentWorkspacePath) {
			return []
		}

		// Return cached results if available and workspace hasn't changed
		if (this.ripgrepFileCache && this.ripgrepCacheWorkspacePath === currentWorkspacePath) {
			return this.ripgrepFileCache
		}

		// If there's an ongoing operation, wait for it
		if (this.ripgrepOperationPromise) {
			try {
				return await this.ripgrepOperationPromise
			} catch (error) {
				// If the ongoing operation failed, we'll start a new one below
				this.ripgrepOperationPromise = null
			}
		}

		try {
			// Start new operation and store the promise
			this.ripgrepOperationPromise = executeRipgrepForFiles(
				currentWorkspacePath,
				500000,
				this.getRipgrepExtraOptions(),
			)
			const fileResults = await this.ripgrepOperationPromise

			// Cache the results and clear the operation promise
			this.ripgrepFileCache = fileResults
			this.ripgrepCacheWorkspacePath = currentWorkspacePath
			this.ripgrepOperationPromise = null

			return fileResults
		} catch (error) {
			console.error("Error getting ripgrep file list:", error)
			this.ripgrepOperationPromise = null
			return []
		}
	}

	/**
	 * Clear the ripgrep file cache
	 * Called when workspace changes or files are modified
	 */
	private clearRipgrepCache() {
		this.ripgrepFileCache = null
		this.ripgrepCacheWorkspacePath = undefined
		this.ripgrepOperationPromise = null
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

		// preheat filelist
		this.getRipgrepFileList()
	}

	private registerListeners() {
		const watcher = vscode.workspace.createFileSystemWatcher("**")
		this.prevWorkSpacePath = this.cwd
		this.disposables.push(
			watcher.onDidCreate(async (uri) => {
				if (!isPathInIgnoredDirectory(uri.fsPath)) {
					this.clearRipgrepCache()
				}
				await this.addFilePath(uri.fsPath)
				this.workspaceDidUpdate()
			}),
		)

		// Renaming files triggers a delete and create event
		this.disposables.push(
			watcher.onDidDelete(async (uri) => {
				if (!isPathInIgnoredDirectory(uri.fsPath)) {
					this.clearRipgrepCache()
				}
				if (await this.removeFilePath(uri.fsPath)) {
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
					event.affectsConfiguration("search.useParentIgnoreFiles")
				) {
					this.clearRipgrepCache()
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
				this.clearRipgrepCache()
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
