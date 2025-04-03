
var Rge = x((_R, Tge) => {
	"use strict"
	Object.defineProperty(_R, "__esModule", { value: !0 })
	_R.default = Kot
	var qot = mR(),
		Vot = Dge(qot),
		Hot = Bge(),
		Wot = Dge(Hot)
	function Dge(e) {
		return e && e.__esModule ? e : { default: e }
	}
	function Got(e) {
		var t = -1,
			r = e.length
		return function () {
			return ++t < r ? { value: e[t], key: t } : null
		}
	}
	function $ot(e) {
		var t = -1
		return function () {
			var n = e.next()
			return n.done ? null : (t++, { value: n.value, key: t })
		}
	}
	function Yot(e) {
		var t = e ? Object.keys(e) : [],
			r = -1,
			n = t.length
		return function i() {
			var s = t[++r]
			return s === "__proto__" ? i() : r < n ? { value: e[s], key: s } : null
		}
	}
	function Kot(e) {
		if ((0, Vot.default)(e)) return Got(e)
		var t = (0, Wot.default)(e)
		return t ? $ot(t) : Yot(e)
	}
	Tge.exports = _R.default
})