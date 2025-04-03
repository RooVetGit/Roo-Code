
function PM(e = 0, t = 0, r = 0, n = "", i = !0) {
	return Object.defineProperty({ major: e, minor: t, patch: r, agent: n, installed: i }, "toString", {
		value() {
			return `${this.major}.${this.minor}.${this.patch}`
		},
		configurable: !1,
		enumerable: !1,
	})
}