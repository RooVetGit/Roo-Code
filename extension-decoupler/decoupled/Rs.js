
function rS(e, t, r, n) {
	let { snippet: i, startLine: s } = i2e(e, t, r, n)
	return i
		.split(
			`
`,
		)
		.map((a, l) => `${String(l + s + 1).padStart(6)}	${a}`).join(`
`)
}