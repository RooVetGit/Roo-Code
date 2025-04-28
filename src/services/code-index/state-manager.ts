import * as vscode from "vscode"

export type IndexingState = "Standby" | "Indexing" | "Indexed" | "Error"

// Define the structure for progress updates
export interface IndexProgressUpdate {
	systemStatus: IndexingState
	message?: string // For details like error messages or current activity
}

export class CodeIndexStateManager {
	private _systemStatus: IndexingState = "Standby"
	private _statusMessage: string = ""
	private _fileStatuses: Record<string, string> = {}
	private _processedBlockCount: number = 0
	private _totalBlockCount: number = 0
	private _progressEmitter = new vscode.EventEmitter<ReturnType<typeof this.getCurrentStatus>>()

	// Webview provider reference for status updates
	private webviewProvider?: { postMessage: (msg: any) => void }

	constructor() {
		// Initialize with default state
	}

	// --- Public API ---

	public readonly onProgressUpdate = this._progressEmitter.event

	public get state(): IndexingState {
		return this._systemStatus
	}

	public setWebviewProvider(provider: { postMessage: (msg: any) => void }) {
		this.webviewProvider = provider
	}

	public getCurrentStatus() {
		return {
			systemStatus: this._systemStatus,
			fileStatuses: this._fileStatuses,
			message: this._statusMessage,
			processedBlockCount: this._processedBlockCount,
			totalBlockCount: this._totalBlockCount,
		}
	}

	// --- State Management ---

	public setSystemState(newState: IndexingState, message?: string): void {
		const stateChanged =
			newState !== this._systemStatus || (message !== undefined && message !== this._statusMessage)

		if (stateChanged) {
			this._systemStatus = newState
			if (message !== undefined) {
				this._statusMessage = message
			}

			// Reset progress counters if moving to a non-indexing state or starting fresh
			if (newState !== "Indexing") {
				this._processedBlockCount = 0
				this._totalBlockCount = 0
				// Optionally clear the message or set a default for non-indexing states
				if (newState === "Standby" && message === undefined) this._statusMessage = "Ready."
				if (newState === "Indexed" && message === undefined) this._statusMessage = "Index up-to-date."
				if (newState === "Error" && message === undefined) this._statusMessage = "An error occurred."
			}

			this.postStatusUpdate()
			this._progressEmitter.fire(this.getCurrentStatus())
			console.log(
				`[CodeIndexStateManager] System state changed to: ${this._systemStatus}${
					message ? ` (${message})` : ""
				}`,
			)
		}
	}

	public updateFileStatus(filePath: string, fileStatus: string, message?: string): void {
		let stateChanged = false

		if (this._fileStatuses[filePath] !== fileStatus) {
			this._fileStatuses[filePath] = fileStatus
			stateChanged = true
		}

		// Update overall message ONLY if indexing and message is provided
		if (message && this._systemStatus === "Indexing" && message !== this._statusMessage) {
			this._statusMessage = message
			stateChanged = true
			console.log(`[CodeIndexStateManager] Status message updated during indexing: ${this._statusMessage}`)
		}

		if (stateChanged) {
			this.postStatusUpdate()
			this._progressEmitter.fire(this.getCurrentStatus())
		}
	}

	private postStatusUpdate() {
		if (this.webviewProvider) {
			this.webviewProvider.postMessage({
				type: "indexingStatusUpdate",
				values: this.getCurrentStatus(),
			})
		}
	}

	public reportBlockIndexingProgress(processedBlocks: number, totalBlocks: number): void {
		const progressChanged = processedBlocks !== this._processedBlockCount || totalBlocks !== this._totalBlockCount

		// Update if progress changes OR if the system wasn't already in 'Indexing' state
		if (progressChanged || this._systemStatus !== "Indexing") {
			this._processedBlockCount = processedBlocks
			this._totalBlockCount = totalBlocks

			const message = `Indexed ${this._processedBlockCount} / ${this._totalBlockCount} blocks found`
			const oldStatus = this._systemStatus
			const oldMessage = this._statusMessage

			this._systemStatus = "Indexing" // Ensure state is Indexing
			this._statusMessage = message

			// Only fire update if status, message or progress actually changed
			if (oldStatus !== this._systemStatus || oldMessage !== this._statusMessage || progressChanged) {
				this.postStatusUpdate()
				this._progressEmitter.fire(this.getCurrentStatus())
				console.log(
					`[CodeIndexStateManager] Block Progress: ${message} (${this._processedBlockCount}/${this._totalBlockCount})`,
				)
			}
		}
	}

	public dispose(): void {
		this._progressEmitter.dispose()
	}
}
