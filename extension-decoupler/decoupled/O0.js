
var O0 = x((HSt, fle) => {
	"use strict"
	var Pd = Yt()
	du()
	Sr()
	var Pje = (fle.exports = Pd.hmac = Pd.hmac || {})
	Pje.create = function () {
		var e = null,
			t = null,
			r = null,
			n = null,
			i = {}
		return (
			(i.start = function (s, o) {
				if (s !== null)
					if (typeof s == "string")
						if (((s = s.toLowerCase()), s in Pd.md.algorithms)) t = Pd.md.algorithms[s].create()
						else throw new Error('Unknown hash algorithm "' + s + '"')
					else t = s
				if (o === null) o = e
				else {
					if (typeof o == "string") o = Pd.util.createBuffer(o)
					else if (Pd.util.isArray(o)) {
						var a = o
						o = Pd.util.createBuffer()
						for (var l = 0; l < a.length; ++l) o.putByte(a[l])
					}
					var c = o.length()
					c > t.blockLength && (t.start(), t.update(o.bytes()), (o = t.digest())),
						(r = Pd.util.createBuffer()),
						(n = Pd.util.createBuffer()),
						(c = o.length())
					for (var l = 0; l < c; ++l) {
						var a = o.at(l)
						r.putByte(54 ^ a), n.putByte(92 ^ a)
					}
					if (c < t.blockLength)
						for (var a = t.blockLength - c, l = 0; l < a; ++l) r.putByte(54), n.putByte(92)
					;(e = o), (r = r.bytes()), (n = n.bytes())
				}
				t.start(), t.update(r)
			}),
			(i.update = function (s) {
				t.update(s)
			}),
			(i.getMac = function () {
				var s = t.digest().bytes()
				return t.start(), t.update(n), t.update(s), t.digest()
			}),
			(i.digest = i.getMac),
			i
		)
	}
})