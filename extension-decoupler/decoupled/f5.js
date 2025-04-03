
var F5 = x((sBt, oce) => {
	"use strict"
	var Bp = Yt()
	Sr()
	Bp.mgf = Bp.mgf || {}
	var tXe = (oce.exports = Bp.mgf.mgf1 = Bp.mgf1 = Bp.mgf1 || {})
	tXe.create = function (e) {
		var t = {
			generate: function (r, n) {
				for (var i = new Bp.util.ByteBuffer(), s = Math.ceil(n / e.digestLength), o = 0; o < s; o++) {
					var a = new Bp.util.ByteBuffer()
					a.putInt32(o), e.start(), e.update(r + a.getBytes()), i.putBuffer(e.digest())
				}
				return i.truncate(i.length() - n), i.getBytes()
			},
		}
		return t
	}
})