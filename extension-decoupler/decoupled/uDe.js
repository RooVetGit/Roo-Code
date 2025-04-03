
var Ude = x((hDt, Lde) => {
	"use strict"
	var yrt = bU(),
		Crt = _ue(),
		vrt = g3(),
		Ert = kue(),
		brt = Uue(),
		xrt = Wue(),
		_rt = $ue(),
		wrt = Kue(),
		Irt = Zue(),
		Srt = QU(),
		Brt = ede(),
		Drt = bE(),
		Trt = rde(),
		Rrt = mde(),
		krt = bde(),
		Mrt = yE(),
		Frt = eB(),
		Qrt = Bde(),
		Nrt = gd(),
		Prt = Fde(),
		Lrt = iB(),
		Urt = UT(),
		Ort = 1,
		qrt = 2,
		Vrt = 4,
		Qde = "[object Arguments]",
		Hrt = "[object Array]",
		Wrt = "[object Boolean]",
		Grt = "[object Date]",
		$rt = "[object Error]",
		Nde = "[object Function]",
		Yrt = "[object GeneratorFunction]",
		Krt = "[object Map]",
		Jrt = "[object Number]",
		Pde = "[object Object]",
		zrt = "[object RegExp]",
		jrt = "[object Set]",
		Zrt = "[object String]",
		Xrt = "[object Symbol]",
		ent = "[object WeakMap]",
		tnt = "[object ArrayBuffer]",
		rnt = "[object DataView]",
		nnt = "[object Float32Array]",
		int = "[object Float64Array]",
		snt = "[object Int8Array]",
		ont = "[object Int16Array]",
		ant = "[object Int32Array]",
		lnt = "[object Uint8Array]",
		cnt = "[object Uint8ClampedArray]",
		unt = "[object Uint16Array]",
		dnt = "[object Uint32Array]",
		pn = {}
	pn[Qde] =
		pn[Hrt] =
		pn[tnt] =
		pn[rnt] =
		pn[Wrt] =
		pn[Grt] =
		pn[nnt] =
		pn[int] =
		pn[snt] =
		pn[ont] =
		pn[ant] =
		pn[Krt] =
		pn[Jrt] =
		pn[Pde] =
		pn[zrt] =
		pn[jrt] =
		pn[Zrt] =
		pn[Xrt] =
		pn[lnt] =
		pn[cnt] =
		pn[unt] =
		pn[dnt] =
			!0
	pn[$rt] = pn[Nde] = pn[ent] = !1
	function qT(e, t, r, n, i, s) {
		var o,
			a = t & Ort,
			l = t & qrt,
			c = t & Vrt
		if ((r && (o = i ? r(e, n, i, s) : r(e)), o !== void 0)) return o
		if (!Nrt(e)) return e
		var u = Mrt(e)
		if (u) {
			if (((o = Trt(e)), !a)) return _rt(e, o)
		} else {
			var f = Drt(e),
				p = f == Nde || f == Yrt
			if (Frt(e)) return xrt(e, a)
			if (f == Pde || f == Qde || (p && !i)) {
				if (((o = l || p ? {} : krt(e)), !a)) return l ? Irt(e, brt(o, e)) : wrt(e, Ert(o, e))
			} else {
				if (!pn[f]) return i ? e : {}
				o = Rrt(e, f, a)
			}
		}
		s || (s = new yrt())
		var g = s.get(e)
		if (g) return g
		s.set(e, o),
			Prt(e)
				? e.forEach(function (C) {
						o.add(qT(C, t, r, C, e, s))
					})
				: Qrt(e) &&
					e.forEach(function (C, v) {
						o.set(v, qT(C, t, r, v, e, s))
					})
		var m = c ? (l ? Brt : Srt) : l ? Urt : Lrt,
			y = u ? void 0 : m(e)
		return (
			Crt(y || e, function (C, v) {
				y && ((v = C), (C = e[v])), vrt(o, v, qT(C, t, r, v, e, s))
			}),
			o
		)
	}
	Lde.exports = qT
})