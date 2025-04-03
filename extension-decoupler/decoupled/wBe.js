
function wbe(e, t) {
	let r = e.split(`
`)
	for (let n of [...t].sort(({ result: { charEnd: i } }, { result: { charEnd: s } }) => s - i))
		r.splice(n.lineRange.start, n.lineRange.stop - n.lineRange.start, p0t(n.result.suggestedCode))
	return r.join(`
`)
}