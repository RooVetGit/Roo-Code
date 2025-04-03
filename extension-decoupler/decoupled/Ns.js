
function nS(e) {
	let t = e.split(`
`),
		r = 0,
		n = 0,
		i = 0
	for (let s of t) {
		if (s.trim() === "") continue
		let o = s.match(/^( +)/),
			a = s.match(/^(\t+)/)
		o ? (r++, i === 0 && (i = o[1].length)) : a && n++
	}
	return n > r ? { type: "tab", size: 1 } : { type: "space", size: i || 2 }
}