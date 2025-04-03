
function Put(e = [], t = Dt.minMatchCharLength) {
	let r = [],
		n = -1,
		i = -1,
		s = 0
	for (let o = e.length; s < o; s += 1) {
		let a = e[s]
		a && n === -1 ? (n = s) : !a && n !== -1 && ((i = s - 1), i - n + 1 >= t && r.push([n, i]), (n = -1))
	}
	return e[s - 1] && s - n >= t && r.push([n, s - 1]), r
}