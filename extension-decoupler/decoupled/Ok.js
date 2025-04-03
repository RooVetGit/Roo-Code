
var ok = class extends z {
	constructor(r, n, i) {
		super()
		this._actionsModel = r
		this._authSession = n
		this._configListener = i
		this.addDisposable(
			this._authSession.onDidChangeSession(() => {
				this._updateSignInState()
			}),
		),
			this.addDisposable(
				this._authSession.onReady(() => {
					this._updateSignInState()
				}),
			),
			this.addDisposable(
				this._configListener.onDidChange(({ newConfig: s, previousConfig: o }) => {
					;(s.apiToken === o.apiToken && s.completionURL === o.completionURL) || this._updateSignInState()
				}),
			),
			this._updateSignInState()
	}
	_updateSignInState() {
		if (!this._authSession.useOAuth) {
			this._actionsModel.setSystemStateStatus("authenticated", "complete")
			return
		}
		if (this._authSession.isLoggedIn === void 0) return
		this._authSession.isLoggedIn === !1 &&
			this._configListener.config.enableDebugFeatures &&
			this._actionsModel.restartActionsState()
		let r = this._authSession.isLoggedIn ? "complete" : "incomplete"
		this._actionsModel.setSystemStateStatus("authenticated", r)
	}
}