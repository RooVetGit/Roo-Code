
var Uhe = x((dTt, Lhe) => {
	"use strict"
	function Nhe(e, t, r, n, i, s, o) {
		try {
			var a = e[s](o),
				l = a.value
		} catch (c) {
			r(c)
			return
		}
		a.done ? t(l) : Promise.resolve(l).then(n, i)
	}
	function ust(e) {
		return function () {
			var t = this,
				r = arguments
			return new Promise(function (n, i) {
				var s = e.apply(t, r)
				function o(l) {
					Nhe(s, n, i, o, a, "next", l)
				}
				function a(l) {
					Nhe(s, n, i, o, a, "throw", l)
				}
				o(void 0)
			})
		}
	}
	function Phe(e, t) {
		var r = Object.keys(e)
		if (Object.getOwnPropertySymbols) {
			var n = Object.getOwnPropertySymbols(e)
			t &&
				(n = n.filter(function (i) {
					return Object.getOwnPropertyDescriptor(e, i).enumerable
				})),
				r.push.apply(r, n)
		}
		return r
	}
	function dst(e) {
		for (var t = 1; t < arguments.length; t++) {
			var r = arguments[t] != null ? arguments[t] : {}
			t % 2
				? Phe(Object(r), !0).forEach(function (n) {
						fst(e, n, r[n])
					})
				: Object.getOwnPropertyDescriptors
					? Object.defineProperties(e, Object.getOwnPropertyDescriptors(r))
					: Phe(Object(r)).forEach(function (n) {
							Object.defineProperty(e, n, Object.getOwnPropertyDescriptor(r, n))
						})
		}
		return e
	}
	function fst(e, t, r) {
		return (
			(t = hst(t)),
			t in e
				? Object.defineProperty(e, t, {
						value: r,
						enumerable: !0,
						configurable: !0,
						writable: !0,
					})
				: (e[t] = r),
			e
		)
	}
	function hst(e) {
		var t = gst(e, "string")
		return typeof t == "symbol" ? t : String(t)
	}
	function gst(e, t) {
		if (typeof e != "object" || e === null) return e
		var r = e[Symbol.toPrimitive]
		if (r !== void 0) {
			var n = r.call(e, t || "default")
			if (typeof n != "object") return n
			throw new TypeError("@@toPrimitive must return a primitive value.")
		}
		return (t === "string" ? String : Number)(e)
	}
	var pst = _h().codes.ERR_INVALID_ARG_TYPE
	function Ast(e, t, r) {
		var n
		if (t && typeof t.next == "function") n = t
		else if (t && t[Symbol.asyncIterator]) n = t[Symbol.asyncIterator]()
		else if (t && t[Symbol.iterator]) n = t[Symbol.iterator]()
		else throw new pst("iterable", ["Iterable"], t)
		var i = new e(dst({ objectMode: !0 }, r)),
			s = !1
		i._read = function () {
			s || ((s = !0), o())
		}
		function o() {
			return a.apply(this, arguments)
		}
		function a() {
			return (
				(a = ust(function* () {
					try {
						var l = yield n.next(),
							c = l.value,
							u = l.done
						u ? i.push(null) : i.push(yield c) ? o() : (s = !1)
					} catch (f) {
						i.destroy(f)
					}
				})),
				a.apply(this, arguments)
			)
		}
		return i
	}
	Lhe.exports = Ast
})