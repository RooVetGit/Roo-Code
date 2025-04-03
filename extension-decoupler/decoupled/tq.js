
var TQ = class extends Lu {
	constructor(r, n, i, s, o, a, l, c, u, f = Ti(i)) {
		super("next-edit-suggestions.html", i)
		this._webviewView = n
		this._suggestionManager = s
		this._globalNextEdit = o
		this._editorEditManager = a
		this._nextEditSessionEventReporter = l
		this._resolveFileService = c
		this._nextEditVSCodeToWebviewMessage = u
		this._asyncMsgHandler = f
		this.loadHTML(r),
			this.addDisposable(this._asyncMsgHandler),
			this._resolveFileService.register(this._asyncMsgHandler),
			this.addDisposable(
				this._suggestionManager.onSuggestionsChanged((p) => {
					let g = $G(
						[this._editorEditManager.state.suggestion]
							.concat(p.newSuggestions)
							.concat(this._suggestionManager.getJustAcceptedSuggestions()),
					).filter(C_(ui, fC))
					this.postMessage({
						type: "next-edit-suggestions-changed",
						data: { suggestions: g },
					}),
						(n.badge = { value: g.length, tooltip: "Next Edit Suggestions" })
				}),
			),
			this.addDisposable(
				new FC.Disposable(
					this._editorEditManager.addStateListener((p, g) => {
						if (p instanceof Ut || p instanceof _r || p instanceof wr) {
							this.postMessage({
								type: "next-edit-preview-active",
								data: p.suggestion,
							})
							return
						}
						if (g instanceof Ut || g instanceof _r || g instanceof wr) {
							this.postMessage({ type: "next-edit-dismiss" })
							return
						}
						if (
							(p.suggestion?.equals(g.suggestion) ?? g.suggestion === void 0) &&
							!(p instanceof Ut) &&
							!(g instanceof Ut)
						)
							return
						let m = $G(
							[this._editorEditManager.state.suggestion]
								.concat(this._suggestionManager.getActiveSuggestions())
								.concat(this._suggestionManager.getJustAcceptedSuggestions()),
						).filter(C_(ui, fC))
						this.postMessage({
							type: "next-edit-suggestions-changed",
							data: { suggestions: m },
						}),
							this.postMessage({
								type: "next-edit-next-suggestion-changed",
								data: p.suggestion,
							})
					}),
				),
			),
			this.addDisposable(
				this._nextEditVSCodeToWebviewMessage.event((p) => {
					this.postMessage(p)
				}),
			),
			this.addDisposable(this._webview.onDidReceiveMessage(this.onDidReceiveMessage)),
			(n.badge = {
				value: this._suggestionManager.getActiveSuggestions().filter(C_(ui)).length,
				tooltip: "Next Edit Suggestions",
			}),
			this._nextEditSessionEventReporter.reportEventWithoutIds("panel-created", "unknown")
	}
	logger = X("NextEditSuggestionsPanel")
	wrapAsyncMsg(r, n, i = null) {
		return this.postMessage({
			type: "async-wrapper",
			requestId: r.requestId,
			error: i,
			baseMsg: n,
		})
	}
	postMessage = async (r) => this._webview.postMessage(r)
	onDidReceiveMessage = async (r) => {
		switch (r.type) {
			case "next-edit-suggestions-action":
				if ("accept" in r.data) {
					await this._editorEditManager.acceptSuggestion(
						Na.from(r.data.accept),
						"next-edit-panel-item-click",
						void 0,
						!0,
					)
					return
				}
				if ("reject" in r.data) {
					this._editorEditManager.rejectSuggestion(Na.from(r.data.reject), "next-edit-panel-item-click")
					return
				}
				if ("undo" in r.data && r.data.undo) {
					this._editorEditManager.undoAcceptSuggestion(Na.from(r.data.undo), "next-edit-panel-item-click")
					return
				}
				if ("acceptAllInFile" in r.data) {
					if (r.data.acceptAllInFile.length === 0) {
						FC.window.showInformationMessage("No Next Edits to accept.")
						return
					}
					this._editorEditManager.acceptAllSuggestionsInFile(
						r.data.acceptAllInFile[0].qualifiedPathName,
						"next-edit-panel-item-click",
					)
					return
				}
				if ("rejectAllInFile" in r.data) {
					if (r.data.rejectAllInFile.length === 0) {
						FC.window.showInformationMessage("No Next Edits to reject.")
						return
					}
					this._editorEditManager.rejectAllSuggestionsInFile(
						r.data.rejectAllInFile[0].qualifiedPathName,
						"next-edit-panel-item-click",
					)
					return
				}
				if ("undoAllInFile" in r.data) {
					if (r.data.undoAllInFile.length === 0) {
						FC.window.showInformationMessage("No Next Edits to undo.")
						return
					}
					this._editorEditManager.undoAllSuggestionsInFile(
						r.data.undoAllInFile[0].qualifiedPathName,
						"next-edit-panel-item-click",
					)
					return
				}
				this.logger.error("Unknown action message: " + JSON.stringify(r))
				return
			case "next-edit-dismiss":
				this._editorEditManager.dismiss("next-edit-panel-item-click", !0, !1)
				return
			case "next-edit-loaded":
				this._nextEditSessionEventReporter.reportEventWithoutIds("panel-opened", "unknown"),
					await this.postMessage({
						type: "next-edit-suggestions-changed",
						data: {
							suggestions: this._suggestionManager
								.getActiveSuggestions()
								.concat(this._suggestionManager.getJustAcceptedSuggestions())
								.filter(C_(ui, fC)),
						},
					}),
					this.postMessage({
						type: "next-edit-next-suggestion-changed",
						data: this._editorEditManager.state.suggestion,
					}),
					this._globalNextEdit.handleWorkspaceEditsAvailable()
				return
			case "next-edit-open-suggestion":
				await this._editorEditManager.open(Na.from(r.data), {
					shouldAutoApply: !1,
					preserveFocus: !0,
					eventSource: "next-edit-panel-item-click",
					animationDelayMs: 0,
				}),
					this._nextEditSessionEventReporter.reportEvent(
						r.data.requestId,
						r.data.result.suggestionId,
						Date.now(),
						"panel-suggestion-clicked",
						"click",
					)
				return
			case "next-edit-refresh-started":
				await this._globalNextEdit.startGlobalQuery(),
					await this.postMessage({ type: "next-edit-refresh-finished" })
				return
			case "next-edit-cancel":
				this._globalNextEdit.cancel()
				return
			case "next-edit-active-suggestion":
				this.postMessage({ type: "next-edit-active-suggestion", data: r.data })
				return
		}
	}
	generateCSPPolicy() {
		return wl(Sl(this._webview), Il(), tF(Xy()), Bl(), Dl(), rF())
	}
}