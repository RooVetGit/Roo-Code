
var fD = x((jIt, $ie) => {
	"use strict"
	$ie.exports = class {
		#e
		constructor(t) {
			if (typeof t != "object" || t === null) throw new TypeError("handler must be an object")
			this.#e = t
		}
		onConnect(...t) {
			return this.#e.onConnect?.(...t)
		}
		onError(...t) {
			return this.#e.onError?.(...t)
		}
		onUpgrade(...t) {
			return this.#e.onUpgrade?.(...t)
		}
		onResponseStarted(...t) {
			return this.#e.onResponseStarted?.(...t)
		}
		onHeaders(...t) {
			return this.#e.onHeaders?.(...t)
		}
		onData(...t) {
			return this.#e.onData?.(...t)
		}
		onComplete(...t) {
			return this.#e.onComplete?.(...t)
		}
		onBodySent(...t) {
			return this.#e.onBodySent?.(...t)
		}
	}
})