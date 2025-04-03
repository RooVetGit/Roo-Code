
function Dut(e, t) {
	let r = [],
		n = !1,
		i = (s, o, a) => {
			if (Sa(s))
				if (!o[a]) r.push(s)
				else {
					let l = o[a],
						c = s[l]
					if (!Sa(c)) return
					if (a === o.length - 1 && (Ru(c) || Fme(c) || but(c))) r.push(Eut(c))
					else if (Jd(c)) {
						n = !0
						for (let u = 0, f = c.length; u < f; u += 1) i(c[u], o, a + 1)
					} else o.length && i(c, o, a + 1)
				}
		}
	return i(e, Ru(t) ? t.split(".") : t, 0), n ? r : r[0]
}