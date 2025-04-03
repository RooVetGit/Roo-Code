
var ode = x((rDt, sde) => {
	"use strict"
	var vtt = OT()
	function Ett(e, t) {
		var r = t ? vtt(e.buffer) : e.buffer
		return new e.constructor(r, e.byteOffset, e.byteLength)
	}
	sde.exports = Ett
})