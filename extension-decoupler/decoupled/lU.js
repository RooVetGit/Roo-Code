
var Lu = class extends z {
	constructor(r, n) {
		super()
		this.filename = r
		this._webview = n
	}
	_logger = X("PanelWebviewBase")
	generateCSPPolicy() {
		return wl(Sl(this._webview), Il(), Sbe(), Bl(), Dl(), rF())
	}
	async loadHTML(r) {
		if (a_()) {
			let o = process.env.AUGMENT_HMR
			this._logger.debug("Loading '%s' from dev server on '%s'", this.filename, o),
				(this._webview.options = {
					enableScripts: !0,
					localResourceRoots: [lF.Uri.parse(o)],
				})
			try {
				this._webview.html = await Ibe(o, this.filename, this.generateCSPPolicy())
				return
			} catch (a) {
				this._logger.error(`Failed to load '%s' from dev server: ${String(a)}`, this.filename)
			}
		}
		let n = lF.Uri.joinPath(r, "common-webviews"),
			i = this._webview.asWebviewUri(lF.Uri.joinPath(n, "/"))
		this._webview.options = { enableScripts: !0, localResourceRoots: [n] }
		let s = await Fr(Qbe.join(n.fsPath, this.filename))
		this._webview.html = xG(s, i.toString(), this.generateCSPPolicy())
	}
}