
var Cc = class {
		_disposables = []
		add(t) {
			if (t === void 0) throw new Error("Attempt to add undefined disposable to DisposableCollection")
			return this._disposables.push(t), t
		}
		addAll(...t) {
			t.forEach((r) => this.add(r))
		}
		adopt(t) {
			this._disposables.push(...t._disposables), (t._disposables.length = 0)
		}
		dispose() {
			for (let t of this._disposables) t.dispose()
			this._disposables.length = 0
		}
	},
	z = class {
		_disposables = new Cc()
		_priorityDisposables = new Cc()
		constructor(t = new Cc(), r = new Cc()) {
			this._disposables.adopt(t), this._priorityDisposables.adopt(r)
		}
		addDisposable(t, r = !1) {
			return r ? this._priorityDisposables.add(t) : this._disposables.add(t)
		}
		addDisposables(...t) {
			this._disposables.addAll(...t)
		}
		dispose() {
			this._priorityDisposables.dispose(), this._disposables.dispose()
		}
	}