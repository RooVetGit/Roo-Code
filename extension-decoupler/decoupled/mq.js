
var MQ = class extends z {
	constructor(r) {
		super()
		this._extensionUri = r
		this.addDisposable(this.visibilityEventEmitter)
	}
	_logger = X("MainPanelWebviewProvider")
	_webviewView = void 0
	_mainPanelWebview = void 0
	currentApp = void 0
	visibilityEventEmitter = new U_e.EventEmitter()
	get onVisibilityChange() {
		return this.visibilityEventEmitter.event
	}
	isVisible() {
		return !!this._webviewView?.visible
	}
	changeApp(r) {
		this.currentApp?.dispose(),
			r && this.addDisposable(r),
			this._setViewTitle(r?.title() || ""),
			(this.currentApp = r),
			this._mainPanelWebview?.changeApp(r)
	}
	_setViewTitle(r) {
		this._webviewView && (this._webviewView.title = r)
	}
	async resolveWebviewView(r, n, i) {
		r.onDidDispose(() => {
			this._webviewView === r &&
				(this._logger.debug("Disposing of main panel webview view"), (this._webviewView = void 0))
		}),
			(this._webviewView = r),
			this._setViewTitle(this.currentApp?.title() || ""),
			this._mainPanelWebview?.dispose(),
			(this._mainPanelWebview = new kQ(this._webviewView.webview)),
			this.addDisposable(this._mainPanelWebview),
			this._mainPanelWebview.changeApp(this.currentApp),
			this._mainPanelWebview.addDisposable(
				this._webviewView.onDidChangeVisibility(() => {
					this.visibilityEventEmitter.fire(!!this._webviewView?.visible)
				}),
			),
			await this._mainPanelWebview.loadHTML(this._extensionUri)
	}
}