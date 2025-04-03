
function gbe(e, t) {
	let r = t.newText
			? t.newText.replaceAll(/\n$/g, "").split(`
`)
			: [],
		n = t.lineChange.originalStartLineNumber - 1,
		i = t.lineChange.originalEndLineNumber - t.lineChange.originalStartLineNumber
	return e.splice(n, i, ...r), e
}