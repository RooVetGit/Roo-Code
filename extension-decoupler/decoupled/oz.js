
var OZ = x((awt, UZ) => {
	"use strict"
	var NZ = Iv(),
		PZ = _U(),
		Tqe = zS(),
		Rqe = xU(),
		kqe = MZ(),
		Mqe = QZ(),
		Fqe = 1,
		Qqe = 2,
		Nqe = "[object Boolean]",
		Pqe = "[object Date]",
		Lqe = "[object Error]",
		Uqe = "[object Map]",
		Oqe = "[object Number]",
		qqe = "[object RegExp]",
		Vqe = "[object Set]",
		Hqe = "[object String]",
		Wqe = "[object Symbol]",
		Gqe = "[object ArrayBuffer]",
		$qe = "[object DataView]",
		LZ = NZ ? NZ.prototype : void 0,
		wU = LZ ? LZ.valueOf : void 0
	function Yqe(e, t, r, n, i, s, o) {
		switch (r) {
			case $qe:
				if (e.byteLength != t.byteLength || e.byteOffset != t.byteOffset) return !1
				;(e = e.buffer), (t = t.buffer)
			case Gqe:
				return !(e.byteLength != t.byteLength || !s(new PZ(e), new PZ(t)))
			case Nqe:
			case Pqe:
			case Oqe:
				return Tqe(+e, +t)
			case Lqe:
				return e.name == t.name && e.message == t.message
			case qqe:
			case Hqe:
				return e == t + ""
			case Uqe:
				var a = kqe
			case Vqe:
				var l = n & Fqe
				if ((a || (a = Mqe), e.size != t.size && !l)) return !1
				var c = o.get(e)
				if (c) return c == t
				;(n |= Qqe), o.set(e, t)
				var u = Rqe(a(e), a(t), n, i, s, o)
				return o.delete(e), u
			case Wqe:
				if (wU) return wU.call(e) == wU.call(t)
		}
		return !1
	}
	UZ.exports = Yqe
})