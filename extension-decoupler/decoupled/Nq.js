
var NQ = class extends z {
	constructor(r, n) {
		super()
		this._globalState = r
		this._syncingStatus = n
		this.loadWorkspaceMessageState(),
			this.addDisposable(this._syncingStatus.onDidChangeSyncingStatus((i) => this._handleSyncingProgress()))
	}
	_workspaceMessageState = new Map()
	_shouldShowSummary = !1
	shouldShowSummaryEmitter = new q_e.EventEmitter()
	get shouldShowSummary() {
		return this._shouldShowSummary
	}
	get onShouldShowSummary() {
		return this.shouldShowSummaryEmitter.event
	}
	setShouldShowSummary(r) {
		this._shouldShowSummary = r
	}
	async _handleSyncingProgress() {
		let r = this._syncingStatus.status
		r.foldersProgress.length !== 0 && (await this.handleShowingSummaryMsg(r))
	}
	async handleShowingSummaryMsg(r) {
		if (
			!(
				r.status !== "done" ||
				r.foldersProgress.every((s) => s.progress?.trackedFiles === void 0 || s.progress.trackedFiles === 0) ||
				r.foldersProgress.find((s) => this._workspaceMessageState.get(s.folderRoot)?.workspaceSummary) ||
				!r.foldersProgress.find((s) => s.progress?.newlyTracked)
			)
		) {
			this.showSummaryMessage()
			for (let s of r.foldersProgress)
				this._workspaceMessageState.set(s.folderRoot, {
					folderRoot: s.folderRoot,
					workspaceSummary: !0,
				})
			await this.saveWorkspaceMessageState()
		}
	}
	showSummaryMessage() {
		;(this._shouldShowSummary = !0), this.shouldShowSummaryEmitter.fire(!0)
	}
	async saveWorkspaceMessageState() {
		await this._globalState.update("workspaceMessageStates", Array.from(this._workspaceMessageState.values()))
	}
	loadWorkspaceMessageState() {
		let r = this._globalState.get("workspaceMessageStates")
		r && (this._workspaceMessageState = new Map(r.map((n) => [n.folderRoot, n])))
	}
	dispose() {
		this.shouldShowSummaryEmitter.dispose()
	}
}