
async function cgt(e, t, r) {
	let i = (await Fr(e)).split(`
`),
		s = t - 1,
		o = r - 1,
		a = i.slice(0, s).reduce((c, u) => c + u.length + 1, 0),
		l = i.slice(0, o + 1).reduce((c, u) => c + u.length + 1, 0) - 1
	return { charStart: a, charEnd: l }
}