
function i2e(e, t, r, n) {
	let i = Math.max(0, t - n),
		s = t + r - 1 + n
	return (
		(e = e.replaceAll(
			`\r
`,
			`
`,
		)),
		{
			snippet: e
				.split(
					`
`,
				)
				.slice(i, s + 1).join(`
`),
			startLine: i,
		}
	)
}