
function L0t(e, t) {
	let r = {}
	for (let s = 0; s < t.length; s++) {
		let o = t[s]
		r[o] ? r[o].push(s) : (r[o] = [s])
	}
	let i = [{ buffer1index: -1, buffer2index: -1, chain: null }]
	for (let s = 0; s < e.length; s++) {
		let o = e[s],
			a = r[o] || [],
			l = 0,
			c = i[0]
		for (let u = 0; u < a.length; u++) {
			let f = a[u],
				p
			for (
				p = l;
				p < i.length && !(i[p].buffer2index < f && (p === i.length - 1 || i[p + 1].buffer2index > f));
				p++
			);
			if (p < i.length) {
				let g = { buffer1index: s, buffer2index: f, chain: i[p] }
				if ((l === i.length ? i.push(c) : (i[l] = c), (l = p + 1), (c = g), l === i.length)) break
			}
		}
		i[l] = c
	}
	return i[i.length - 1]
}