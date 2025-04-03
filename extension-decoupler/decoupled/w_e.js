
function W_e(e, t) {
	let r = Math.min(e.length, t.length),
		n = 1024,
		i = 0
	for (; i < r; ) {
		let s = e.slice(i, i + n),
			o = t.slice(i, i + n)
		if (s !== o) break
		if (s.length === 0) throw new Error(`unexpected empty block: s1=${e}, s2=${t}`)
		i += s.length
	}
	for (; i < r && e[i] === t[i]; ) i++
	return i
}