
function Kut(e, t) {
	let r = e.matches
	;(t.matches = []),
		Sa(r) &&
			r.forEach((n) => {
				if (!Sa(n.indices) || !n.indices.length) return
				let { indices: i, value: s } = n,
					o = { indices: i, value: s }
				n.key && (o.key = n.key.src), n.idx > -1 && (o.refIndex = n.idx), t.matches.push(o)
			})
}