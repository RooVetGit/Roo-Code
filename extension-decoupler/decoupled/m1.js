
var J0t = 5,
	k1 = class extends z {
		constructor(r, n) {
			super()
			this._keybindingWatcher = r
			this._inlineCompletionProvider = n
			this.createDecorationTypes(), this.addDisposables(...this.setupEmptyFileHint())
			let i = os.window.activeTextEditor
			i && i.document.getText() === "" && this.debouncedDecorations(i),
				this._logger.info("HotKeyHints initialized")
		}
		_logger = X("HotKeyHints")
		activeCompletion = !1
		emptyFileHotKeyHintDecorationType
		debouncedDecorations = (0, o8.default)(
			(r) => {
				;(r.document.uri.scheme === "file" || r.document.uri.scheme === "untitled") &&
				r.document.getText() === "" &&
				!this.activeCompletion
					? r.setDecorations(this.emptyFileHotKeyHintDecorationType, [r.selection])
					: this.hideHints(r)
			},
			J0t,
			{ leading: !1, trailing: !0 },
		)
		createDecorationTypes() {
			let r = this._keybindingWatcher.getKeybindingForCommand(Hi.commandID),
				n = ""
			r ? (n = `${r} to open Augment.`) : (n = "Click the robot icon in the side bar to open Augment."),
				(this.emptyFileHotKeyHintDecorationType = os.window.createTextEditorDecorationType({
					after: {
						contentText: n,
						color: "rgba(150, 150, 150, 0.9)",
						margin: "0 0 0 0.5rem",
					},
				}))
		}
		setupEmptyFileHint() {
			let r = []
			return (
				r.push({
					dispose: () => {
						this.debouncedDecorations.cancel()
					},
				}),
				this._inlineCompletionProvider &&
					(r.push(
						Mc((n) => {
							let i = os.window.activeTextEditor
							!i ||
								!n ||
								n.completions.length === 0 ||
								(this.debouncedDecorations.cancel(), this.hideHints(i), (this.activeCompletion = !0))
						}),
					),
					r.push(
						mA(() => {
							this.activeCompletion = !1
							let n = os.window.activeTextEditor
							!n || n.document.getText() !== "" || this.debouncedDecorations(n)
						}),
					)),
				os.workspace.onDidCloseTextDocument(() => {
					this.activeCompletion = !1
				}),
				r.push(
					os.window.onDidChangeActiveTextEditor((n) => {
						!n ||
							n.document.getText() !== "" ||
							((this.activeCompletion = !1), this.debouncedDecorations(n))
					}),
				),
				r.push(
					os.workspace.onDidChangeTextDocument((n) => {
						if (
							(n.contentChanges.length > 0 && (this.activeCompletion = !1),
							n.document.uri.scheme !== "file" && n.document.uri.scheme !== "untitled")
						)
							return
						let i = os.window.activeTextEditor
						if (!(!i || i.document.uri.toString() !== n.document.uri.toString())) {
							if (i.document.getText() !== "") {
								this.hideHints(i)
								return
							}
							this.activeCompletion || this.debouncedDecorations(i)
						}
					}),
				),
				r
			)
		}
		hideHints(r) {
			r.setDecorations(this.emptyFileHotKeyHintDecorationType, [])
		}
	},
	M1 = class extends z {
		constructor(r, n) {
			super()
			this._keybindingWatcher = r
			this._inlineCompletionProvider = n
			this.createDecorationTypes(), this.addDisposables(...this.setupEmptyLineHint())
		}
		_logger = X("EmptyLineHints")
		activeCompletion = !1
		decorationType
		debouncedDecorations = (0, o8.default)(
			(r) => {
				let n = r.selection.active,
					s = r.document.lineAt(n.line).text,
					o = s.lastIndexOf(" ") !== -1 ? s.lastIndexOf(" ") : s.length - 1,
					a = new os.Range(n.line, o + 1, n.line, o + 1)
				;/\S/.test(s) === !1 && (s.trim() === "" || n.character === s.length)
					? r.setDecorations(this.decorationType, [a])
					: this.hideHints(r)
			},
			16,
			{ leading: !1, trailing: !0 },
		)
		createDecorationTypes() {
			let r = "",
				n = this._keybindingWatcher.getKeybindingForCommand("augment-chat.focus", !0)
			n && (r = `${n} to open Augment`),
				(this.decorationType = os.window.createTextEditorDecorationType({
					after: {
						contentText: r,
						color: "rgba(150, 150, 150, 0.5)",
						margin: "0 0 0 1.2rem",
					},
				}))
		}
		setupEmptyLineHint() {
			let r = []
			return (
				r.push({
					dispose: () => {
						this.debouncedDecorations.cancel()
					},
				}),
				this._inlineCompletionProvider &&
					(r.push(
						Mc((n) => {
							let i = os.window.activeTextEditor
							!i ||
								!n ||
								n.completions.length === 0 ||
								(this.debouncedDecorations.cancel(), this.hideHints(i), (this.activeCompletion = !0))
						}),
					),
					r.push(
						mA(() => {
							this.activeCompletion = !1
							let n = os.window.activeTextEditor
							n && this.debouncedDecorations(n)
						}),
					)),
				r.push(
					os.window.onDidChangeTextEditorSelection((n) => {
						this.debouncedDecorations(n.textEditor)
					}),
				),
				r.push(
					os.workspace.onDidChangeTextDocument((n) => {
						let i = os.window.activeTextEditor
						!i ||
							i.document.uri.toString() !== n.document.uri.toString() ||
							this.activeCompletion ||
							this.debouncedDecorations(i)
					}),
				),
				r
			)
		}
		hideHints(r) {
			r.setDecorations(this.decorationType, [])
		}
	}