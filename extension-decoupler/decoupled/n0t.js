
function N0t(e, t, r, n) {
	let i = vI(e, t, r, n, "", "", { context: 3 })
	return [
		{
			id: Math.random().toString(36).substring(2, 15),
			path: e || t,
			diff: i,
			originalCode: r,
			modifiedCode: n,
		},
	]
}