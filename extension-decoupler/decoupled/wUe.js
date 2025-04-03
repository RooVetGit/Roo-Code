
var Wue = x((Vb, X0) => {
	"use strict"
	var Ket = Ka(),
		Hue = typeof Vb == "object" && Vb && !Vb.nodeType && Vb,
		Oue = Hue && typeof X0 == "object" && X0 && !X0.nodeType && X0,
		Jet = Oue && Oue.exports === Hue,
		que = Jet ? Ket.Buffer : void 0,
		Vue = que ? que.allocUnsafe : void 0
	function zet(e, t) {
		if (t) return e.slice()
		var r = e.length,
			n = Vue ? Vue(r) : new e.constructor(r)
		return e.copy(n), n
	}
	X0.exports = zet
})