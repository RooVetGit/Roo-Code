
	var Dle = function (e, t, r) {
		var n = !1,
			i = null,
			s = null,
			o = null,
			a,
			l,
			c,
			u,
			f = []
		for (e = Vo.rc2.expandKey(e, t), c = 0; c < 64; c++) f.push(e.getInt16Le())
		r
			? ((a = function (m) {
					for (c = 0; c < 4; c++)
						(m[c] += f[u] + (m[(c + 3) % 4] & m[(c + 2) % 4]) + (~m[(c + 3) % 4] & m[(c + 1) % 4])),
							(m[c] = Zje(m[c], Ble[c])),
							u++
				}),
				(l = function (m) {
					for (c = 0; c < 4; c++) m[c] += f[m[(c + 3) % 4] & 63]
				}))
			: ((a = function (m) {
					for (c = 3; c >= 0; c--)
						(m[c] = Xje(m[c], Ble[c])),
							(m[c] -= f[u] + (m[(c + 3) % 4] & m[(c + 2) % 4]) + (~m[(c + 3) % 4] & m[(c + 1) % 4])),
							u--
				}),
				(l = function (m) {
					for (c = 3; c >= 0; c--) m[c] -= f[m[(c + 3) % 4] & 63]
				}))
		var p = function (m) {
				var y = []
				for (c = 0; c < 4; c++) {
					var C = i.getInt16Le()
					o !== null && (r ? (C ^= o.getInt16Le()) : o.putInt16Le(C)), y.push(C & 65535)
				}
				u = r ? 0 : 63
				for (var v = 0; v < m.length; v++) for (var b = 0; b < m[v][0]; b++) m[v][1](y)
				for (c = 0; c < 4; c++)
					o !== null && (r ? o.putInt16Le(y[c]) : (y[c] ^= o.getInt16Le())), s.putInt16Le(y[c])
			},
			g = null
		return (
			(g = {
				start: function (m, y) {
					m && typeof m == "string" && (m = Vo.util.createBuffer(m)),
						(n = !1),
						(i = Vo.util.createBuffer()),
						(s = y || new Vo.util.createBuffer()),
						(o = m),
						(g.output = s)
				},
				update: function (m) {
					for (n || i.putBuffer(m); i.length() >= 8; )
						p([
							[5, a],
							[1, l],
							[6, a],
							[1, l],
							[5, a],
						])
				},
				finish: function (m) {
					var y = !0
					if (r)
						if (m) y = m(8, i, !r)
						else {
							var C = i.length() === 8 ? 8 : 8 - i.length()
							i.fillWithByte(C, C)
						}
					if ((y && ((n = !0), g.update()), !r && ((y = i.length() === 0), y)))
						if (m) y = m(8, s, !r)
						else {
							var v = s.length(),
								b = s.at(v - 1)
							b > v ? (y = !1) : s.truncate(b)
						}
					return y
				},
			}),
			g
		)
	}