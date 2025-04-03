
var OQ = class extends z {
	_workspaceManager = void 0
	_syncingEnabledChangedEmitter = new qQ.EventEmitter()
	_publishStateExecutor
	constructor() {
		super(),
			(this._publishStateExecutor = new Ku(async () => {
				await this._publishSyncingState()
			}))
	}
	get syncingEnabledState() {
		return this._workspaceManager ? this._workspaceManager.syncingEnabledState : "initializing"
	}
	get onDidChangeSyncingEnabled() {
		return this._syncingEnabledChangedEmitter.event
	}
	enableSyncing() {
		if (this.syncingEnabledState === "initializing") throw new Error("Syncing enabled state not initialized")
		this.syncingEnabledState !== "enabled" && this._workspaceManager.enableSyncing()
	}
	disableSyncing() {
		if (this.syncingEnabledState === "initializing") throw new Error("Syncing enabled state not initialized")
		this.syncingEnabledState !== "disabled" && this._workspaceManager.disableSyncing()
	}
	set workspaceManager(t) {
		;(this._workspaceManager = t),
			this.addDisposable(
				this._workspaceManager.onDidChangeSyncingState((r) => void this._publishStateExecutor.kick()),
			)
	}
	async _publishSyncingState() {
		await qQ.commands.executeCommand("setContext", "vscode-augment.syncingEnabledState", this.syncingEnabledState),
			this._syncingEnabledChangedEmitter.fire(this.syncingEnabledState)
	}
}