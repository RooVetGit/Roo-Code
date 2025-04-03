
var Nue = x((GBt, Que) => {
	"use strict"
	var Qet = gd(),
		Net = nB(),
		Pet = Fue(),
		Let = Object.prototype,
		Uet = Let.hasOwnProperty
	function Oet(e) {
		if (!Qet(e)) return Pet(e)
		var t = Net(e),
			r = []
		for (var n in e) (n == "constructor" && (t || !Uet.call(e, n))) || r.push(n)
		return r
	}
	Que.exports = Oet
})