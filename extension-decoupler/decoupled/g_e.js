
function G_e(e, t) {
	let r = Math.min(e.length, t.length),
		n = 1024,
		i = 0
	for (; i < r; ) {
		let a = e.slice(Math.max(0, e.length - i - n), e.length - i),
			l = t.slice(Math.max(0, t.length - i - n), t.length - i)
		if (a !== l) break
		if (a.length === 0) throw new Error(`unexpected empty block: s1=${e}, s2=${t}`)
		i += a.length
	}
	let s = e.length - 1,
		o = t.length - 1
	for (; i < r && e[s - i] === t[o - i]; ) i++
	return i
}