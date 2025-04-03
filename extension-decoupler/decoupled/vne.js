
function VNe(e, t) {
	t = t || {}
	var r = new TNe(t)
	r.noRefs || qNe(e, r)
	var n = e
	return (
		r.replacer && (n = r.replacer.call({ "": n }, "", n)),
		vd(r, 0, n, !0, !0)
			? r.dump +
				`
`
			: ""
	)
}