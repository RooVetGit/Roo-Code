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
	private _progressEmitter = new vscode.EventEmitter<{
		systemStatus: IndexingState
		fileStatuses: Record<string, string>
		message?: string
	}>()

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
			this.postStatusUpdate()
			this._progressEmitter.fire({
				systemStatus: this._systemStatus,
				fileStatuses: this._fileStatuses,
				message: this._statusMessage,
			})
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
			this._progressEmitter.fire({
				systemStatus: this._systemStatus,
				fileStatuses: this._fileStatuses,
				message: this._statusMessage,
			})
		}
	}

	private postStatusUpdate() {
		if (this.webviewProvider) {
			this.webviewProvider.postMessage({
				type: "indexingStatusUpdate",
				values: {
					systemStatus: this._systemStatus,
					message: this._statusMessage,
					// Optionally include fileStatuses if the webview needs it
					// fileStatuses: this._fileStatuses
				},
			})
		}
	}

	public dispose(): void {
		this._progressEmitter.dispose()
	}
}
