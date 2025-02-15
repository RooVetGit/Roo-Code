import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import ignore, { Ignore } from "ignore"
import { fileExistsAtPath } from "../../utils/fs"

export class ReclineIgnoreController {
	private ignoreInstance: Ignore
	private disposables: vscode.Disposable[] = []
	private cwd: string

	constructor(cwd: string) {
		this.cwd = cwd
		this.ignoreInstance = ignore()
		this.setupFileWatcher()
	}

	public async initialize(): Promise<void> {
		await this.loadIgnoreFile()
	}

	private setupFileWatcher(): void {
		const ignorePattern = new vscode.RelativePattern(this.cwd, ".rooignore")
		const watcher = vscode.workspace.createFileSystemWatcher(ignorePattern)
		this.disposables.push(
			watcher.onDidChange(() => this.loadIgnoreFile()),
			watcher.onDidCreate(() => this.loadIgnoreFile()),
			watcher.onDidDelete(() => this.loadIgnoreFile()),
			watcher,
		)
	}

	private async loadIgnoreFile(): Promise<void> {
		// Reset the ignore instance
		this.ignoreInstance = ignore()
		const ignorePath = path.join(this.cwd, ".rooignore")
		if (await fileExistsAtPath(ignorePath)) {
			try {
				const content = await fs.readFile(ignorePath, "utf8")
				this.ignoreInstance.add(content)
				// Always ignore the .rooignore file itself.
				this.ignoreInstance.add(".rooignore")
			} catch (error) {
				console.error("Error loading .rooignore:", error)
				vscode.window.showWarningMessage("Error loading .rooignore file.")
			}
		}
	}

	public validateAccess(filePath: string): boolean {
		try {
			const absolutePath = path.resolve(this.cwd, filePath)
			const relativePath = path.relative(this.cwd, absolutePath).split(path.sep).join(path.posix.sep)
			return !this.ignoreInstance.ignores(relativePath)
		} catch (error) {
			// On error, allow access to avoid accidentally blocking files.
			return true
		}
	}

	public filterPaths(paths: string[]): string[] {
		return paths.filter((file) => this.validateAccess(file))
	}

	public dispose(): void {
		this.disposables.forEach((d) => d.dispose())
		this.disposables = []
	}
}
