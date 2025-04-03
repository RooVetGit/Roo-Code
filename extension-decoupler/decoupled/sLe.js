
	function sle() {
		;(p5 = !0), (ile = [0, 1, 2, 4, 8, 16, 32, 64, 128, 27, 54])
		for (var e = new Array(256), t = 0; t < 128; ++t) (e[t] = t << 1), (e[t + 128] = ((t + 128) << 1) ^ 283)
		;(so = new Array(256)), (h5 = new Array(256)), (xp = new Array(4)), (hc = new Array(4))
		for (var t = 0; t < 4; ++t) (xp[t] = new Array(256)), (hc[t] = new Array(256))
		for (var r = 0, n = 0, i, s, o, a, l, c, u, t = 0; t < 256; ++t) {
			;(a = n ^ (n << 1) ^ (n << 2) ^ (n << 3) ^ (n << 4)),
				(a = (a >> 8) ^ (a & 255) ^ 99),
				(so[r] = a),
				(h5[a] = r),
				(l = e[a]),
				(i = e[r]),
				(s = e[i]),
				(o = e[s]),
				(c = (l << 24) ^ (a << 16) ^ (a << 8) ^ (a ^ l)),
				(u = ((i ^ s ^ o) << 24) ^ ((r ^ o) << 16) ^ ((r ^ s ^ o) << 8) ^ (r ^ i ^ o))
			for (var f = 0; f < 4; ++f)
				(xp[f][r] = c), (hc[f][a] = u), (c = (c << 24) | (c >>> 8)), (u = (u << 24) | (u >>> 8))
			r === 0 ? (r = n = 1) : ((r = i ^ e[e[e[i ^ o]]]), (n ^= e[e[n]]))
		}
	}