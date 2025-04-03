
function Pme(e) {
	let t = null,
		r = null,
		n = null,
		i = 1,
		s = null
	if (Ru(e) || Jd(e)) (n = e), (t = Tme(e)), (r = _W(e))
	else {
		if (!Dme.call(e, "name")) throw new Error(Sut("name"))
		let o = e.name
		if (((n = o), Dme.call(e, "weight") && ((i = e.weight), i <= 0))) throw new Error(But(o))
		;(t = Tme(o)), (r = _W(o)), (s = e.getFn)
	}
	return { path: t, id: r, weight: i, src: n, getFn: s }
}