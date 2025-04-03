
var BN = class extends z {
	constructor(r) {
		super()
		this._workspaceManager = r
		this.addDisposable(xwe.window.onDidChangeActiveTextEditor(this._notifyActiveEditorChanged.bind(this)))
	}
	_tabSwitchHistory = new SN(20)
	_logger = X("TabWatcher")
	_notifyActiveEditorChanged(r) {
		if (r === void 0) return
		let n = r.document.uri
		this._workspaceManager.resolvePathName(n.fsPath) !== void 0 && this._tabSwitchHistory.add(n.fsPath)
	}
	getTabSwitchEvents() {
		let r = []
		for (let n of this._tabSwitchHistory.toArray()) {
			let i = this._workspaceManager.resolvePathName(n)
			if (i === void 0) continue
			let s = this._workspaceManager.getBlobName(i)
			s !== void 0 && r.push({ relPathName: i.relPath, blobName: s })
		}
		return r
	}
}