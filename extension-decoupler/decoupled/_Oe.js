
var _oe = x((pSt, xoe) => {
	"use strict"
	var { kConstruct: db } = MD(),
		{ Cache: ND } = boe(),
		{ webidl: Vs } = ys(),
		{ kEnumerableProperty: fb } = Xt(),
		PD = class e {
			#e = new Map()
			constructor() {
				arguments[0] !== db && Vs.illegalConstructor(), Vs.util.markAsUncloneable(this)
			}
			async match(t, r = {}) {
				if (
					(Vs.brandCheck(this, e),
					Vs.argumentLengthCheck(arguments, 1, "CacheStorage.match"),
					(t = Vs.converters.RequestInfo(t)),
					(r = Vs.converters.MultiCacheQueryOptions(r)),
					r.cacheName != null)
				) {
					if (this.#e.has(r.cacheName)) {
						let n = this.#e.get(r.cacheName)
						return await new ND(db, n).match(t, r)
					}
				} else
					for (let n of this.#e.values()) {
						let s = await new ND(db, n).match(t, r)
						if (s !== void 0) return s
					}
			}
			async has(t) {
				Vs.brandCheck(this, e)
				let r = "CacheStorage.has"
				return (
					Vs.argumentLengthCheck(arguments, 1, r),
					(t = Vs.converters.DOMString(t, r, "cacheName")),
					this.#e.has(t)
				)
			}
			async open(t) {
				Vs.brandCheck(this, e)
				let r = "CacheStorage.open"
				if (
					(Vs.argumentLengthCheck(arguments, 1, r),
					(t = Vs.converters.DOMString(t, r, "cacheName")),
					this.#e.has(t))
				) {
					let i = this.#e.get(t)
					return new ND(db, i)
				}
				let n = []
				return this.#e.set(t, n), new ND(db, n)
			}
			async delete(t) {
				Vs.brandCheck(this, e)
				let r = "CacheStorage.delete"
				return (
					Vs.argumentLengthCheck(arguments, 1, r),
					(t = Vs.converters.DOMString(t, r, "cacheName")),
					this.#e.delete(t)
				)
			}
			async keys() {
				return Vs.brandCheck(this, e), [...this.#e.keys()]
			}
		}
	Object.defineProperties(PD.prototype, {
		[Symbol.toStringTag]: { value: "CacheStorage", configurable: !0 },
		match: fb,
		has: fb,
		open: fb,
		delete: fb,
		keys: fb,
	})
	xoe.exports = { CacheStorage: PD }
})