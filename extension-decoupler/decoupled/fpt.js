
function Fpt(e) {
	let t = new Set(),
		r = {}
	return (
		eG(e, (n) => {
			let [i, s, o] = n.split(qy)
			t.add(i), (r[i] = r[i] || []).push({ line: mn(s), path: i, preview: o })
		}),
		{ paths: t, results: r }
	)
}