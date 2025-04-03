
var sA = class e extends z {
	constructor(r, n, i, s, o, a) {
		super()
		this._extensionUri = r
		this._conversationId = n
		this._initialIterationId = i
		this._initialStage = s
		this._chatApp = o
		this._resolveFileService = a
		;(this._panel = Sc.window.createWebviewPanel(e.viewType, "Augment", Sc.ViewColumn.One, {
			retainContextWhenHidden: !0,
			enableScripts: !0,
		})),
			(this._detailsPanelAsyncMsgHandler = Ti(this._panel.webview)),
			this._detailsPanelAsyncMsgHandler.registerHandler(
				"autofix-panel-details-init-request",
				this.handleAutofixInitMessage,
			),
			this._detailsPanelAsyncMsgHandler.registerHandler(
				"autofix-panel-apply-and-retest-request",
				this.handleAutofixApplyAndRetestRequest.bind(this),
			),
			this._resolveFileService.register(this._detailsPanelAsyncMsgHandler),
			(this._panel.iconPath = {
				light: Sc.Uri.joinPath(this._extensionUri, "media", "panel-icon-light.svg"),
				dark: Sc.Uri.joinPath(this._extensionUri, "media", "panel-icon-dark.svg"),
			}),
			this.addDisposables(
				this._panel,
				new Sc.Disposable(() => {
					e.currentPanel = void 0
				}),
			),
			this._panel.onDidDispose(() => {
				this.dispose(), (e.currentPanel = void 0)
			}),
			this._setHTML()
	}
	static viewType = "augmentAutofixPanel"
	_logger = X("AutofixWebviewPanel")
	static currentPanel
	_panel
	_detailsPanelAsyncMsgHandler
	get logger() {
		return this._logger
	}
	async _setHTML() {
		let r = this._panel.webview,
			n = Sc.Uri.joinPath(this._extensionUri, "common-webviews")
		r.options = { enableScripts: !0, localResourceRoots: [n] }
		let i = r.asWebviewUri(Sc.Uri.joinPath(n, "/")),
			s = wl(Sl(r), Il(), Bl(), Dl(), Wy()),
			o = await Fr(Bbe.default.join(n.fsPath, "autofix.html"))
		;(o = o.replace(
			/<head>/i,
			`<head>
            <base href="${i.toString()}" />
            <meta http-equiv="Content-Security-Policy" content="${s}">
        `,
		)),
			(r.html = o)
	}
	static launchAutofixPanel(r, n, i, s, o, a) {
		if (e.currentPanel)
			if (e.currentPanel._conversationId === n) {
				e.currentPanel.openSpecificStage(i, s), e.currentPanel._panel.reveal()
				return
			} else e.currentPanel.dispose()
		e.currentPanel = new e(r, n, i, s, o, a)
	}
	handleAutofixStateUpdate = async (r) => {
		await this._panel.webview.postMessage({
			type: "autofix-panel-state-update",
			data: r.data,
		})
	}
	handleCommandPartialOutput = async (r) => {
		await this._panel.webview.postMessage(r)
	}
	handleAutofixInitMessage = async (r) => (
		await this._chatApp.sendAutofixUpdateRequestMessage(),
		{
			type: "autofix-panel-open-specific-stage",
			data: {
				iterationId: this._initialIterationId,
				stage: this._initialStage,
			},
		}
	)
	handleAutofixApplyAndRetestRequest = async (r) => (
		await this._applyAllAutofixChanges(r.data.selectedSolutions),
		await this._chatApp.sendAutofixSuggestionsAppliedMessage(r.data.selectedSolutions),
		{ type: "empty" }
	)
	async openSpecificStage(r, n) {
		await this._panel.webview.postMessage({
			type: "autofix-panel-open-specific-stage",
			data: { iterationId: r, stage: n },
		})
	}
	async _applyAutofixChanges(r, n) {
		let i = await Fr(r),
			s = wbe(i, n)
		await Bu(r, s)
	}
	async _applyAllAutofixChanges(r) {
		let n = new Map()
		for (let i of r) {
			let s = Bs(i.qualifiedPathName)
			n.has(s) ? n.get(s).push(i) : n.set(s, [i])
		}
		for (let [i, s] of n.entries()) await this._applyAutofixChanges(i, s)
	}
}