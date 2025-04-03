
	function _te(e, t, r = 0, n = 1) {
		class i {
			#e
			#t
			#i
			constructor(o, a) {
				;(this.#e = o), (this.#t = a), (this.#i = 0)
			}
			next() {
				if (typeof this != "object" || this === null || !(#e in this))
					throw new TypeError(`'next' called on an object that does not implement interface ${e} Iterator.`)
				let o = this.#i,
					a = this.#e[t],
					l = a.length
				if (o >= l) return { value: void 0, done: !0 }
				let { [r]: c, [n]: u } = a[o]
				this.#i = o + 1
				let f
				switch (this.#t) {
					case "key":
						f = c
						break
					case "value":
						f = u
						break
					case "key+value":
						f = [c, u]
						break
				}
				return { value: f, done: !1 }
			}
		}
		return (
			delete i.prototype.constructor,
			Object.setPrototypeOf(i.prototype, ZWe),
			Object.defineProperties(i.prototype, {
				[Symbol.toStringTag]: {
					writable: !1,
					enumerable: !1,
					configurable: !0,
					value: `${e} Iterator`,
				},
				next: { writable: !0, enumerable: !0, configurable: !0 },
			}),
			function (s, o) {
				return new i(s, o)
			}
		)
	}