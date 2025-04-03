
var lg = class extends N_ {
		explicit = !1
		format() {
			return "Tracked"
		}
	},
	B8 = class extends N_ {
		constructor(r) {
			super()
			this.ignoreSourceName = r
		}
		explicit = !0
		format() {
			return `Tracked (${this.ignoreSourceName})`
		}
	},
	D8 = class extends ag {
		constructor(r) {
			super()
			this.ignoreSourceName = r
		}
		explicit = !0
		format() {
			return `Not tracked (${this.ignoreSourceName})`
		}
	},
	YQ = class {
		constructor(t, r, n, i) {
			this.dirName = t
			this.ignoreSource = r
			this.rules = n
			this.next = i
		}
	},
	T8 = class e {
		constructor(t, r, n) {
			this._rootUri = t
			this._ignoreSource = r
			this._top = n
		}
		static async buildNew(t, r, n) {
			let i = new Array()
			if (Yd(n, r) !== "") {
				let o = r
				for (;;) {
					o = _x(o)
					let a = Yd(n, o),
						l = await t.getRules(o)
					if ((l && i.push([a, t, l]), a === "")) break
				}
			}
			let s
			for (let o = i.length - 1; o >= 0; o--) {
				let [a, l, c] = i[o]
				s = new YQ(a, l, c, s)
			}
			return new e(n, t, s)
		}
		async buildAtop(t, r) {
			let n = await this._ignoreSource.getRules(t, r)
			if (n === void 0) return this
			let i = Yd(this._rootUri, t),
				s = new YQ(i, this._ignoreSource, n, this._top)
			return new e(this._rootUri, this._ignoreSource, s)
		}
		getPathInfo(t) {
			for (let r = this._top; r !== void 0; r = r.next) {
				if (!Ss(r.dirName, t))
					throw new Error(`candidatePath "${t}" is not below ignore file's parent "${r.dirName}"`)
				let n = t.slice(r.dirName.length),
					i = r.rules.test(n)
				if (i.ignored) return new D8(r.ignoreSource.getName(P_.Uri.joinPath(this._rootUri, r.dirName)))
				if (i.unignored) return new B8(r.ignoreSource.getName(P_.Uri.joinPath(this._rootUri, r.dirName)))
			}
			return new lg()
		}
	},
	R8 = class e {
		constructor(t, r) {
			this._ignoreSources = t
			this._ignoreStacks = r
		}
		static async buildNew(t, r, n) {
			let i = new Array()
			for (let s of t) {
				let o = await T8.buildNew(s, r, n)
				i.push(o)
			}
			return new e(t, i)
		}
		async buildAtop(t, r) {
			let n = new Array(),
				i = 0
			for (let s = 0; s < this._ignoreStacks.length; s++) {
				let o = this._ignoreStacks[s],
					a = await o.buildAtop(t, r)
				a !== o && i++, n.push(a)
			}
			return i === 0 ? this : new e(this._ignoreSources, n)
		}
		getPathInfo(t) {
			for (let r = this._ignoreStacks.length - 1; r >= 0; r--) {
				let i = this._ignoreStacks[r].getPathInfo(t)
				if (i.explicit) return i
			}
			return new lg()
		}
	}