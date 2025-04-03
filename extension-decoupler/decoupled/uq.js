
var UQ = class extends z {
	constructor(r, n) {
		super()
		this._statusBarManager = r
		this._syncingEnabledTracker = n
		this.addDisposable(
			this._syncingEnabledTracker.onDidChangeSyncingEnabled((s) => this._updateSyncingState(s === "enabled")),
		)
		let i = this._syncingEnabledTracker.syncingEnabledState
		i !== "initializing" && this._updateSyncingState(i === "enabled")
	}
	_syncingDisabledDisp = void 0
	_updateSyncingState(r) {
		r
			? (this._syncingDisabledDisp?.dispose(), (this._syncingDisabledDisp = void 0))
			: this._syncingDisabledDisp || (this._syncingDisabledDisp = this._statusBarManager.setState(jxe))
	}
}