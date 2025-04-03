
var Tx = class {
	constructor({ getFn: t = Dt.getFn, fieldNormWeight: r = Dt.fieldNormWeight } = {}) {
		;(this.norm = Qut(r, 3)), (this.getFn = t), (this.isCreated = !1), this.setIndexRecords()
	}
	setSources(t = []) {
		this.docs = t
	}
	setIndexRecords(t = []) {
		this.records = t
	}
	setKeys(t = []) {
		;(this.keys = t),
			(this._keysMap = {}),
			t.forEach((r, n) => {
				this._keysMap[r.id] = n
			})
	}
	create() {
		this.isCreated ||
			!this.docs.length ||
			((this.isCreated = !0),
			Ru(this.docs[0])
				? this.docs.forEach((t, r) => {
						this._addString(t, r)
					})
				: this.docs.forEach((t, r) => {
						this._addObject(t, r)
					}),
			this.norm.clear())
	}
	add(t) {
		let r = this.size()
		Ru(t) ? this._addString(t, r) : this._addObject(t, r)
	}
	removeAt(t) {
		this.records.splice(t, 1)
		for (let r = t, n = this.size(); r < n; r += 1) this.records[r].i -= 1
	}
	getValueForItemAtKeyId(t, r) {
		return t[this._keysMap[r]]
	}
	size() {
		return this.records.length
	}
	_addString(t, r) {
		if (!Sa(t) || bW(t)) return
		let n = { v: t, i: r, n: this.norm.get(t) }
		this.records.push(n)
	}
	_addObject(t, r) {
		let n = { i: r, $: {} }
		this.keys.forEach((i, s) => {
			let o = i.getFn ? i.getFn(t) : this.getFn(t, i.path)
			if (Sa(o)) {
				if (Jd(o)) {
					let a = [],
						l = [{ nestedArrIndex: -1, value: o }]
					for (; l.length; ) {
						let { nestedArrIndex: c, value: u } = l.pop()
						if (Sa(u))
							if (Ru(u) && !bW(u)) {
								let f = { v: u, i: c, n: this.norm.get(u) }
								a.push(f)
							} else
								Jd(u) &&
									u.forEach((f, p) => {
										l.push({ nestedArrIndex: p, value: f })
									})
					}
					n.$[s] = a
				} else if (Ru(o) && !bW(o)) {
					let a = { v: o, n: this.norm.get(o) }
					n.$[s] = a
				}
			}
		}),
			this.records.push(n)
	}
	toJSON() {
		return { keys: this.keys, records: this.records }
	}
}