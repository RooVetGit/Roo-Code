
var $o = class extends rW {
		constructor(r) {
			super()
			this._processItem = r
		}
		insert(r, n, i = !1) {
			return this._insert(r, n, i)
		}
		get(r) {
			return this._items.get(r)
		}
		async _processEntry(r) {
			return this._processItem(r)
		}
	},
	Ia = class {
		constructor(t) {
			this._processItem = t
		}
		_keys = new Set()
		_items = new Array()
		_inProgress = !1
		_stopping = !1
		get size() {
			return this._items.length
		}
		dispose() {
			this._stopping = !0
		}
		insert(t) {
			return this._keys.has(t) ? !1 : (this._keys.add(t), this._items.push(t), !0)
		}
		async kick() {
			if (!(this._inProgress || this._stopping)) {
				for (this._inProgress = !0; this._items.length > 0 && !this._stopping; ) {
					let t = this._items
					this._keys.clear(), (this._items = new Array())
					for (let r of t) {
						try {
							await this._processItem(r)
						} catch {}
						if (this._stopping) break
					}
				}
				;(this._inProgress = !1), await this._processItem(void 0)
			}
		}
	},
	vc = class {
		constructor(t, r) {
			this._toKick = t
			this._intervalId = setInterval(this._kick.bind(this), r)
		}
		_intervalId
		_kick() {
			this._toKick.kick()
		}
		dispose() {
			this._intervalId !== void 0 && clearInterval(this._intervalId)
		}
	},
	rk = class {
		constructor(t) {
			this._processItem = t
		}
		_items = []
		_inProgress = !1
		_stopping = !1
		get size() {
			return this._items.length
		}
		dispose() {
			this._stopping = !0
		}
		insert(t) {
			return new Promise((r, n) => {
				this._items.push({ itemArg: t, resolve: r, reject: n })
			})
		}
		insertAndKick(t) {
			let r = this.insert(t)
			return this.kick(), r
		}
		async kick() {
			if (!(this._inProgress || this._stopping)) {
				for (this._inProgress = !0; this._items.length > 0 && !this._stopping; ) {
					let t = this._items.pop()
					try {
						let r = await this._processItem(t.itemArg)
						t.resolve(r)
					} catch (r) {
						t.reject(r)
					}
				}
				;(this._inProgress = !1), await this._processItem(void 0)
			}
		}
	}