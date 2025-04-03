
var $0t = 2e3,
	S1 = class extends z {
		constructor(r, n, i, s, o) {
			super()
			this._completionsModel = r
			this._config = s
			this._timelineReporter = o
			;(this._pendingCompletions = new w1(n)),
				(this._stateController = new yA(i)),
				this.addDisposable(this._pendingCompletions),
				this.addDisposable(this._deletedCompletions),
				this.addDisposable(
					Xh.window.onDidChangeTextEditorSelection((a) => {
						a.textEditor.document.uri.scheme === "file" && uf(!1)
					}),
				)
		}
		_logger = X("InlineCompletionProvider")
		_pendingCompletions
		_deletedCompletions = new I1()
		_stateController
		async provideInlineCompletionItems(r, n, i, s) {
			let o = new _1()
			if (
				!this._config.config.completions.enableAutomaticCompletions &&
				i.triggerKind === Xh.InlineCompletionTriggerKind.Automatic
			)
				return uf(!1), []
			this._stateController.dispose(),
				this._logger.debug(
					`Inline Request - ${r.uri.toString()} ${Zh(r, n)}${v1(" ", i.selectedCompletionInfo?.text)}`,
				),
				this._logger.verbose(Dxe(r, i))
			let a = await this._getCompletions(r, n, i, o),
				l = this._deletedCompletions.processRequest(a)
			if (s.isCancellationRequested) return this._logger.debug("Completion cancelled"), pxe(), uf(!1), []
			if ((gxe(l), !l)) return this._logger.debug("Returning no completions"), uf(!1), []
			;(o.emitTime = Date.now()), l.isReused || this._timelineReporter.reportCompletionTimeline(l.requestId, o)
			let c = l.completions.map((u) => {
				this._logger.verbose(`AugmentCompletion: ${u.toString()}`)
				let f = new Xh.InlineCompletionItem(
					u.completionText + u.suffixReplacementText,
					new Xh.Range(
						r.positionAt(u.range.startOffset),
						r.positionAt(u.range.endOffset + u.skippedSuffix.length),
					),
				)
				return (
					this._logger.verbose(`InlineCompletionItem: ${JSON.stringify(f.insertText)} ${AC(r, f.range)}`), f
				)
			})
			return c.length > 0 && uf(!0), c
		}
		async _getCompletions(r, n, i, s) {
			let o = this._pendingCompletions.getPendingCompletion(r, n)
			if (o && o.completions.length > 0) {
				let l = this._processCompletionForMode(o, i)
				return this._logger.debug(`Returning ${l.length} completions`), { ...o, completions: l }
			}
			if (i.selectedCompletionInfo?.text) {
				this._logger.debug(
					"Returning no completions because the provider request includes selected text that does not match an Augment suggestion",
				)
				return
			}
			let a = this._stateController.setState($xe)
			try {
				let l = await this._completionsModel.generateCompletion(r, n, s)
				if (l && l.completions.length === 0) {
					let c = this._stateController.setState(Yxe)
					setTimeout(() => {
						c.dispose()
					}, $0t)
				}
				return l
			} catch (l) {
				l instanceof bh || this._stateController.setState(Gxe)
			} finally {
				a.dispose()
			}
		}
		_processCompletionForMode(r, n) {
			if (!n.selectedCompletionInfo || !n.selectedCompletionInfo.text) return r.completions
			let i = n.selectedCompletionInfo.range.start
			return r.completions.map((o) => C1(r, o, i))
		}
	}