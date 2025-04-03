
function ybe(e, t) {
	let { replacementStartLine: r, replacementEndLine: n, replacementText: i, replacementOldText: s } = t
	return (
		Wn(r) || (e.startLineNumber = r),
		Wn(n) || (e.endLineNumber = n),
		Wn(i) || (e.newText += i),
		Wn(s) || (e.oldText += s),
		e
	)
}