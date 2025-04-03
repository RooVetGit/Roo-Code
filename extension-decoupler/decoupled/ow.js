
function OW(e) {
	let t = new Map()
	for (let n of e) {
		if (n.charStart >= n.charEnd) continue
		let i = t.get(n.blobName) ?? []
		i.push(n), t.set(n.blobName, i)
	}
	let r = []
	for (let [n, i] of t) {
		let s = i
			.sort((o, a) => o.charStart - a.charStart)
			.reduce((o, a) => {
				let l = o[o.length - 1]
				return l && l.charEnd + 1 >= a.charStart ? (l.charEnd = a.charEnd) : o.push(a), o
			}, [])
		r.push(...s)
	}
	return r
}