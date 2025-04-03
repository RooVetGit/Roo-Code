
var C7 = x((E_t, y7) => {
	"use strict"
	var wUe = gE()
	function IUe(e, t) {
		var r = this.__data__,
			n = wUe(r, e)
		return n < 0 ? (++this.size, r.push([e, t])) : (r[n][1] = t), this
	}
	y7.exports = IUe
})