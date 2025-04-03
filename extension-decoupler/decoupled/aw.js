
function AW(e) {
	let t = e[0].split(`
`).length
	if (
		!e.every(
			(r) =>
				r.split(`
`).length === t,
		)
	)
		throw new Error("All animation frames must have the same number of lines")
	return t
}