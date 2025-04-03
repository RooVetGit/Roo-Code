
var _E = x((Ywt, Nee) => {
	"use strict"
	var AHe = require("events"),
		AB = class extends AHe {
			dispatch() {
				throw new Error("not implemented")
			}
			close() {
				throw new Error("not implemented")
			}
			destroy() {
				throw new Error("not implemented")
			}
			compose(...t) {
				let r = Array.isArray(t[0]) ? t[0] : t,
					n = this.dispatch.bind(this)
				for (let i of r)
					if (i != null) {
						if (typeof i != "function")
							throw new TypeError(`invalid interceptor, expected function received ${typeof i}`)
						if (((n = i(n)), n == null || typeof n != "function" || n.length !== 2))
							throw new TypeError("invalid interceptor")
					}
				return new AO(this, n)
			}
		},
		AO = class extends AB {
			#e = null
			#t = null
			constructor(t, r) {
				super(), (this.#e = t), (this.#t = r)
			}
			dispatch(...t) {
				this.#t(...t)
			}
			close(...t) {
				return this.#e.close(...t)
			}
			destroy(...t) {
				return this.#e.destroy(...t)
			}
		}
	Nee.exports = AB
})