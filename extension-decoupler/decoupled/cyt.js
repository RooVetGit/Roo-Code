
var Cyt = 2,
	vyt = 200,
	Eyt = 80,
	byt = 3,
	xyt = 3,
	_yt = 4,
	kC = class e extends z {
		constructor(r, n, i, s, o) {
			super()
			this._configListener = r
			this._context = n
			this._keybindingWatcher = i
			this._featureFlagManager = s
			this._hints = o
			;(this._decorations = new m8(this._context, this._keybindingWatcher, this._hints)),
				(this._hoverPanel = new y8()),
				(this.showHintDecoration = _Q.debounce((a) => {
					this._decorations.decorate(a)
				}, vyt))
		}
		_decorations
		_previousEditor
		_hoverPanel
		showHintDecoration
		enable() {
			this.dispose(),
				(this._configListener.config.enableDebugFeatures ||
					Gr(this._featureFlagManager.currentFlags.vscodeChatHintDecorationMinVersion)) &&
					(this._hoverPanel.enable(),
					this.addDisposable(
						Ks.window.onDidChangeActiveTextEditor((r) => {
							this._decorations.clearDecorations(this._previousEditor),
								(this._previousEditor = r),
								r && e.canDecorateEditor(r) && this.enableMultilineSelectionHints(r.selection)
						}),
					),
					this.addDisposable(
						Ks.window.onDidChangeTextEditorSelection((r) => {
							if (!e.canDecorateEditor(r.textEditor)) return
							let n = r.selections[0]
							this.enableMultilineSelectionHints(n)
						}),
					))
		}
		dispose() {
			super.dispose(), this._decorations.clearDecorations(), this._hoverPanel.dispose()
		}
		enableMultilineSelectionHints(r) {
			this._decorations.clearDecorations(),
				r.isSingleLine
					? this._hoverPanel.setRange()
					: (this.showHintDecoration(this.getOffsetLine(r)), this._hoverPanel.setRange(r.start, r.end))
		}
		static canDecorateEditor(r) {
			return r.document.uri.scheme === "file" || r.document.uri.scheme === "untitled"
		}
		getOffsetLine(r) {
			let n = Ks.window.activeTextEditor,
				i = r.active.line < r.anchor.line
			if (!n) return i ? r.active.line - 1 : r.active.line + 1
			let s = i ? 1 : -1,
				o = [Math.min(r.anchor.line, r.active.line), Math.max(r.anchor.line, r.active.line)],
				a = r.active.line + s * Cyt,
				l = r.active.line,
				c = [Math.min(a, l), Math.max(a, l)],
				u = _Q.range(Math.max(c[0], o[0]), Math.min(c[1], o[1]) + 1)
			return (
				u.sort((f, p) => {
					let g = n.document.lineAt(f).text.length - n.document.lineAt(p).text.length
					return g === 0 ? (i ? f - p : p - f) : g
				}),
				u[0] === r.active.line ? u[1] : u[0]
			)
		}
	},
	m8 = class {
		constructor(t, r, n) {
			this._context = t
			this._keybindingWatcher = r
			this._hints = n
			;(this._rightSpacerDecorationType = d8()),
				(this._keyHintDecorationTypes = []),
				this._hints.forEach((i, s) => {
					let o = B_(i.keyBindingId, this._keybindingWatcher, this._context)
					this._decorationLength += o.length * xyt
					let a = {
						keyBindingDecorationTypes: f8(),
						textDecorationType: aQ(i.text),
					}
					;(this._decorationLength += i.text.length),
						s < this._hints.length - 1 &&
							((a.gapDecorationType = aQ(" | ")), (this._decorationLength += _yt)),
						this._keyHintDecorationTypes.push(a)
				})
		}
		_rightSpacerDecorationType
		_keyHintDecorationTypes
		_decorationLength = 0
		decorate(t) {
			let r = Ks.window.activeTextEditor
			if (!r || !kC.canDecorateEditor(r) || this._keyHintDecorationTypes.length === 0) return
			let n = ig(r, t),
				i = r.document.lineAt(t).text.length,
				s = Math.max(Eyt - i - this._decorationLength, byt)
			r.setDecorations(this._rightSpacerDecorationType, [
				{ range: n, renderOptions: { after: { margin: `0 0 0 ${s}ch` } } },
			]),
				this._keyHintDecorationTypes.forEach((o, a) => {
					let l = B_(this._hints[a].keyBindingId, this._keybindingWatcher, this._context)
					o.keyBindingDecorationTypes.forEach((c, u) => {
						l[u] && r.setDecorations(c, [{ range: n, renderOptions: l[u] }])
					}),
						r.setDecorations(o.textDecorationType, [{ range: n }]),
						o.gapDecorationType &&
							r.setDecorations(o.gapDecorationType, [
								{
									range: n,
									renderOptions: { after: { margin: "0 0.65em 0 0.5em" } },
								},
							])
				})
		}
		clearDecorations(t) {
			let r = t ?? Ks.window.activeTextEditor
			r &&
				(r.setDecorations(this._rightSpacerDecorationType, []),
				this._keyHintDecorationTypes.forEach((n) => {
					n.keyBindingDecorationTypes.forEach((i) => {
						r.setDecorations(i, [])
					}),
						r.setDecorations(n.textDecorationType, []),
						n.gapDecorationType && r.setDecorations(n.gapDecorationType, [])
				}))
		}
	},
	y8 = class extends z {
		_provider
		_range
		enable() {
			this.registerHoverProvider(Ks.window.activeTextEditor),
				this.addDisposable(
					Ks.window.onDidChangeActiveTextEditor((t) => {
						this.registerHoverProvider(t)
					}),
				)
		}
		setRange(t, r) {
			if (t && r) {
				this._range = new Ks.Range(t, r)
				return
			}
			this._range = void 0
		}
		provideHover(t, r, n) {
			if (this._range && this._range.contains(r)) {
				let i = `
$(augment-icon-simple)
&nbsp;
<a href="command:${Hi.commandID}" title="Open Augment Chat">
    Open in Chat
</a> |
<a href="command:${Gh.commandID}" title="Fix with Augment Chat">
    Fix
</a> |
<a href="command:${iC.commandID}" title="Explain with Augment Chat">
    Explain
</a> | <a href="command:${sC.commandID}" title="Write a test with Augment Chat">
    Write a Test
</a> | <a href="command:${oC.commandID}" title="Document with Augment Chat">
    Document
</a>
            `,
					s = new Ks.MarkdownString(i)
				return (
					(s.isTrusted = !0), (s.supportHtml = !0), (s.supportThemeIcons = !0), new Ks.Hover(s, this._range)
				)
			}
		}
		registerHoverProvider(t) {
			this._provider?.dispose(),
				(this._provider = void 0),
				!(!t || !kC.canDecorateEditor(t)) &&
					(this._provider = Ks.languages.registerHoverProvider({ pattern: t.document.uri.fsPath }, this))
		}
	}