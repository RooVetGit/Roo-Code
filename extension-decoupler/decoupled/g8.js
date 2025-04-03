
var G8 = W(gs()),
	aN = class {
		store
		primaryKey
		constructor(t) {
			;(this.store = {}), (this.primaryKey = t)
		}
		add(t) {
			let r = t[this.primaryKey]
			if (this.get(r)) throw new Error(`Record with primary key ${r} already exists.`)
			this.store[r] = Object.assign({}, t)
		}
		update(t, r) {
			this.store[t] = { ...this.store[t], ...r }
		}
		delete(t) {
			let r = this.store[t]
			return delete this.store[t], r
		}
		deleteBy(t) {
			let r = this.search(t)
			for (let n of r) this.delete(n[this.primaryKey])
		}
		get(t) {
			return this.store[t]
		}
		search(t, { limit: r } = {}) {
			let n = 0,
				i = []
			for (let s of Object.values(this.store))
				if (G8.default.every(t, (o, a) => G8.default.isEqual(s[a], o)) && (i.push(s), n++, r && n >= r)) break
			return i
		}
		getAll() {
			return Object.values(this.store)
		}
		clear() {
			this.store = {}
		}
	}