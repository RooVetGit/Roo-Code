
function WP(e, t) {
	let r = e.split(`
`),
		n = t.type === "tab" ? /^\t/ : new RegExp(`^ {1,${t.size}}`)
	return r.map((i) => i.replace(n, "")).join(`
`)
}