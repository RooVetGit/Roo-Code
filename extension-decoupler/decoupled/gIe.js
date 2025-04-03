
	function gie(e, t) {
		let r = t.query ? Q9e(t.path, t.query) : t.path,
			n = typeof r == "string" ? cie(r) : r,
			i = e.filter(({ consumed: s }) => !s).filter(({ path: s }) => kd(cie(s), n))
		if (i.length === 0) throw new fp(`Mock dispatch not matched for path '${n}'`)
		if (((i = i.filter(({ method: s }) => kd(s, t.method))), i.length === 0))
			throw new fp(`Mock dispatch not matched for method '${t.method}' on path '${n}'`)
		if (((i = i.filter(({ body: s }) => (typeof s < "u" ? kd(s, t.body) : !0))), i.length === 0))
			throw new fp(`Mock dispatch not matched for body '${t.body}' on path '${n}'`)
		if (((i = i.filter((s) => fie(s, t.headers))), i.length === 0)) {
			let s = typeof t.headers == "object" ? JSON.stringify(t.headers) : t.headers
			throw new fp(`Mock dispatch not matched for headers '${s}' on path '${n}'`)
		}
		return i[0]
	}