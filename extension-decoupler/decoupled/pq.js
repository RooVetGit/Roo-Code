
var PQ = class extends z {
	constructor(r, n) {
		super()
		this._statusBar = r
		this.addDisposables(
			n((i) => this._handleSyncingStatusChanged(i)),
			new LQ.Disposable(() => {
				this._syncingStatusBarDisposable?.dispose(), (this._syncingStatusBarDisposable = void 0)
			}),
		)
	}
	static syncingMessage =
		"Augment is synchronizing with your codebase to make better suggestions. The first time typically takes a few minutes."
	_syncingStatusBarDisposable
	_syncingNotificationShown = !1
	_handleSyncingStatusChanged(r) {
		switch (r.status) {
			case "longRunning":
				this._syncingNotificationShown ||
					(r.foldersProgress.find((i) => i.progress?.newlyTracked) &&
						((this._syncingNotificationShown = !0), LQ.commands.executeCommand(Hi.commandID)))
			case "running":
				this._syncingStatusBarDisposable || (this._syncingStatusBarDisposable = this._statusBar.setState(Nxe))
				break
			case "done":
				;(this._syncingNotificationShown = !1),
					this._syncingStatusBarDisposable?.dispose(),
					(this._syncingStatusBarDisposable = void 0)
				break
		}
	}
}