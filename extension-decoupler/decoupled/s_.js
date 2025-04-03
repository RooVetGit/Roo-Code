
var l_e = new xC.EventEmitter(),
	vA = l_e.event,
	S_ = class extends z {
		constructor(r, n, i) {
			super()
			this._reportId = n
			this._vcsDetails = i
			this._logger = X(`HeadChangeWatcher[${r}]`)
		}
		_logger
		listening = !1
		handleChange = () => {
			this._logger.debug("handling HEAD change"), l_e.fire({ repoId: this._reportId })
		}
		listenForChanges() {
			if (this.listening) return
			if (this._vcsDetails.toolName !== "git") throw new Error("only git is supported for now")
			let r = xC.workspace.createFileSystemWatcher(
				new xC.RelativePattern(this._vcsDetails.root, ".git/logs/HEAD"),
			)
			this.addDisposables(
				r,
				r.onDidCreate(this.handleChange),
				r.onDidChange(this.handleChange),
				r.onDidDelete(this.handleChange),
			),
				(this.listening = !0),
				this._logger.debug("Listening for HEAD changes.")
		}
	}