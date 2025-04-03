
function t2e(e) {
	let t = e.includes(`\r
`)
		? `\r
`
		: `
`
	return e
		.split(t)
		.map((i) => i.replace(/\s+$/, ""))
		.join(t)
}