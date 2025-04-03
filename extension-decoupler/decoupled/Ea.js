
var EA = class extends z {
	_document
	_lastSetAt
	_observable
	constructor(t = void 0, r = 1) {
		super(), (this._observable = this.addDisposable(new ta(t)))
		let n = (i) => {
			this.value === void 0 ||
				(i && this._document && i !== this._document) ||
				(this._lastSetAt && Date.now() - this._lastSetAt < r) ||
				this.clear()
		}
		this.addDisposable(
			R_.window.onDidChangeActiveTextEditor(() => {
				n()
			}),
		),
			this.addDisposable(
				R_.window.onDidChangeTextEditorSelection((i) => {
					n(i.textEditor.document)
				}),
			),
			this.addDisposable(
				R_.workspace.onDidChangeTextDocument((i) => {
					n(i.document)
				}),
			)
	}
	get value() {
		return this._observable.value
	}
	listen(t, r = !1) {
		return this._observable.listen(t, r)
	}
	waitUntil(t, r) {
		return this._observable.waitUntil(t, r)
	}
	set(t, r) {
		;(this._lastSetAt = Date.now()), (this._document = r), (this._observable.value = t)
	}
	clear() {
		;(this._document = void 0), (this._observable.value = void 0)
	}
}