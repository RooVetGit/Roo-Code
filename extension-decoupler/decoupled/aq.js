
var uyt = new Map([
		[Fa, "vscode-augment.nextEdit.canGotoHinting"],
		[Xo, "vscode-augment.nextEdit.canNext"],
		[Ou, "vscode-augment.nextEdit.canPrevious"],
		[Dc, "vscode-augment.nextEdit.canAccept"],
		[Tc, "vscode-augment.nextEdit.canReject"],
		[Uu, "vscode-augment.nextEdit.canDismiss"],
		[sf, "vscode-augment.nextEdit.canAcceptCodeAction"],
		[uA, "vscode-augment.nextEdit.canAcceptAll"],
		[dA, "vscode-augment.nextEdit.canRejectAll"],
		[Co, "vscode-augment.nextEdit.canUndoAcceptSuggestion"],
	]),
	AQ = class extends z {
		constructor(r) {
			super()
			this._state = r
			this.addDisposable(
				new I_e.Disposable(
					this._state.listen((n) => {
						let i = !(n instanceof Kn)
						this._set(Fa, i),
							this._set(Xo, i),
							this._set(Ou, i),
							this._set(Dc, n instanceof _r || n instanceof wr || n instanceof Ut),
							this._set(Tc, n instanceof _r || n instanceof wr || n instanceof Ut),
							this._set(Co, n instanceof Ut),
							this._set(Uu, i),
							this._set(sf, n instanceof Ut),
							this._set(uA, i),
							this._set(dA, i)
					}, !0),
				),
			)
		}
		_status = new Map()
		get(r) {
			return this._status.get(r) ?? !1
		}
		_set(r, n) {
			this._status.set(r, n)
			let i = uyt.get(r)
			i && xc(i, n)
		}
	}