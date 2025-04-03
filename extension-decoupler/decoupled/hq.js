
var HQ = class extends z {
	constructor(r, n) {
		super()
		this._featureFlagManager = r
		this._workspaceManager = n
		this.addDisposable(this._workspaceManager.onDidChangeSourceFolders(() => this._handleSourceFoldersChanged())),
			this.addDisposable(
				this._workspaceManager.onDidChangeSyncingProgress((i) => this._handleSyncingProgressChanged(i)),
			),
			this._handleSourceFoldersChanged()
	}
	_newFolders = new Set()
	_folderBacklogSize = new Map()
	_folderTrackedFilesSize = new Map()
	_syncingStatusEmitter = new V_e.EventEmitter()
	_status = { status: "done", foldersProgress: [] }
	get status() {
		return this._status
	}
	get onDidChangeSyncingStatus() {
		return this._syncingStatusEmitter.event
	}
	_handleSourceFoldersChanged() {
		this._newFolders.clear(),
			this._folderBacklogSize.clear(),
			this._folderTrackedFilesSize.clear(),
			this._workspaceManager.getSyncingProgress().forEach((r) => this._updateFolderState(r)),
			this._reportSyncingStatus()
	}
	_handleSyncingProgressChanged(r) {
		this._updateFolderState(r), this._reportSyncingStatus()
	}
	_updateFolderState(r) {
		r.progress !== void 0 &&
			(r.progress.newlyTracked ? this._newFolders.add(r.folderRoot) : this._newFolders.delete(r.folderRoot),
			this._folderBacklogSize.set(r.folderRoot, r.progress.backlogSize),
			this._folderTrackedFilesSize.set(r.folderRoot, r.progress.trackedFiles))
	}
	_reportSyncingStatus() {
		let r = !1,
			n = 0,
			i = 0,
			s = this._featureFlagManager.currentFlags
		this._folderBacklogSize.forEach((a, l) => {
			a >= s.bigSyncThreshold && (r = !0), (n += a)
		}),
			this._folderTrackedFilesSize.forEach((a, l) => {
				i += a
			})
		let o = "done"
		r ? (o = "longRunning") : (n > s.smallSyncThreshold || n / i >= 0.1) && (o = "running"),
			(this._status = {
				status: o,
				foldersProgress: this._workspaceManager.getSyncingProgress(),
			}),
			this._syncingStatusEmitter.fire(this._status)
	}
}