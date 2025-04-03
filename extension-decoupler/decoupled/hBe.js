
function* hbe(e, t, r) {
	let n = vbe(e, r, 3, !0)
	n.length > 0 && (yield { chunkContinue: { newText: n } })
	let i = zM(e),
		s = ZM(i, t),
		o = jM(i, s)
	yield {
		chunkEnd: {
			originalStartLine: e.startLineNumber,
			originalEndLine: e.endLineNumber,
			stagedStartLine: o.lineChange.originalStartLineNumber,
			stagedEndLine: o.lineChange.originalEndLineNumber,
		},
	},
		t.push(f0t(i, r))
}