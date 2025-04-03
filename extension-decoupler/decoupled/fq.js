
var FQ = class extends z {
	constructor(r, n, i) {
		super()
		this._config = r
		this._featureFlagsManager = n
		this.onWebviewCreated = i
		this.maybeRegisterWebview()
	}
	webviewView = void 0
	nextEditWebview = void 0
	maybeRegisterWebview = () => {
		!this.webviewView ||
			!Rl(this._config.config, this._featureFlagsManager.currentFlags.vscodeNextEditMinVersion) ||
			(this.nextEditWebview?.dispose(),
			(this.nextEditWebview = this.onWebviewCreated(this.webviewView)),
			this.addDisposable(this.nextEditWebview))
	}
	resolveWebviewView(r, n, i) {
		;(this.webviewView = r), this.maybeRegisterWebview()
	}
}