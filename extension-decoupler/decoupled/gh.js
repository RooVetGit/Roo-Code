
var nC = class extends Jo {
		constructor(r, n, i, s, o, a) {
			super(s, o, a)
			this._extension = r
			this._configListener = n
			this._chatExtensionEvent = i
			;(this._extension = r), (this._configListener = n), (this._chatExtensionEvent = i)
		}
		type = "public"
		canRun() {
			return this._extension.ready
		}
		updateSelectionToCoverDiagnostics(r) {
			let n = $h.window.activeTextEditor
			if (n) {
				let i
				if (r && !r.every((s) => n.selection.contains(s.range))) {
					let s = Math.min(...r.map((c) => c.range.start.line)),
						o = Math.max(...r.map((c) => c.range.end.line)),
						a = new $h.Position(s, 0),
						l = n.document.lineAt(o).range.end
					i = new $h.Range(a, l)
				} else n.selection.isEmpty && (i = n.document.lineAt(n.selection.active.line).range)
				i && (n.selection = new $h.Selection(i.start, i.end))
			}
		}
	},
	Gh = class extends nC {
		static commandID = "vscode-augment.chat.slash.fix"
		constructor(t, r, n, i) {
			super(t, r, n, i, "Fix using Augment", !1)
		}
		async run(t, r) {
			await nf("Quick Fix"),
				r && this.updateSelectionToCoverDiagnostics(r),
				this._chatExtensionEvent.fire("runSlashFix")
		}
	},
	iC = class extends nC {
		static commandID = "vscode-augment.chat.slash.explain"
		constructor(t, r, n, i) {
			super(t, r, n, i, "Explain using Augment", !1)
		}
		async run() {
			await nf("Explain"), this._chatExtensionEvent.fire("runSlashExplain")
		}
	},
	sC = class extends nC {
		static commandID = "vscode-augment.chat.slash.test"
		constructor(t, r, n, i) {
			super(t, r, n, i, "Write test using Augment", !1)
		}
		async run() {
			await nf("Write a Test"), this._chatExtensionEvent.fire("runSlashTest")
		}
	},
	oC = class extends nC {
		static commandID = "vscode-augment.chat.slash.document"
		constructor(t, r, n, i) {
			super(t, r, n, i, "Document", !0)
		}
		async run() {
			await nf("Document"), this._chatExtensionEvent.fire("runSlashDocument")
		}
	}