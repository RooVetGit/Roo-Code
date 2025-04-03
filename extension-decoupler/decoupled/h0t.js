
function h0t(e, t) {
	if (pbe(e, t)) return 0
	if (pbe(t, e)) {
		let r = t.lineChange.originalEndLineNumber - t.lineChange.originalStartLineNumber
		return t.lineChange.modifiedEndLineNumber - t.lineChange.modifiedStartLineNumber - r
	} else throw new Error("Edits overlap, which is not supported")
}