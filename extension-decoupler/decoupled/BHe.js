
var Bhe = x((z3, She) => {
	"use strict"
	var iR = require("buffer"),
		Eu = iR.Buffer
	function Ihe(e, t) {
		for (var r in e) t[r] = e[r]
	}
	Eu.from && Eu.alloc && Eu.allocUnsafe && Eu.allocUnsafeSlow ? (She.exports = iR) : (Ihe(iR, z3), (z3.Buffer = Pp))
	function Pp(e, t, r) {
		return Eu(e, t, r)
	}
	Pp.prototype = Object.create(Eu.prototype)
	Ihe(Eu, Pp)
	Pp.from = function (e, t, r) {
		if (typeof e == "number") throw new TypeError("Argument must not be a number")
		return Eu(e, t, r)
	}
	Pp.alloc = function (e, t, r) {
		if (typeof e != "number") throw new TypeError("Argument must be a number")
		var n = Eu(e)
		return t !== void 0 ? (typeof r == "string" ? n.fill(t, r) : n.fill(t)) : n.fill(0), n
	}
	Pp.allocUnsafe = function (e) {
		if (typeof e != "number") throw new TypeError("Argument must be a number")
		return Eu(e)
	}
	Pp.allocUnsafeSlow = function (e) {
		if (typeof e != "number") throw new TypeError("Argument must be a number")
		return iR.SlowBuffer(e)
	}
})