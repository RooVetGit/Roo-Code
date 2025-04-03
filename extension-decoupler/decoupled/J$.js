
var J$ = x((cvt, K$) => {
	"use strict"
	var Hke = k$(),
		$$ = gd(),
		Wke = G$(),
		Y$ = NaN,
		Gke = /^[-+]0x[0-9a-f]+$/i,
		$ke = /^0b[01]+$/i,
		Yke = /^0o[0-7]+$/i,
		Kke = parseInt
	function Jke(e) {
		if (typeof e == "number") return e
		if (Wke(e)) return Y$
		if ($$(e)) {
			var t = typeof e.valueOf == "function" ? e.valueOf() : e
			e = $$(t) ? t + "" : t
		}
		if (typeof e != "string") return e === 0 ? e : +e
		e = Hke(e)
		var r = $ke.test(e)
		return r || Yke.test(e) ? Kke(e.slice(2), r ? 2 : 8) : Gke.test(e) ? Y$ : +e
	}
	K$.exports = Jke
})