
function C1(e, t, r) {
	let n = "",
		i = t.completionText,
		s = e.document,
		o = s.offsetAt(r) - t.range.startOffset
	return (
		o < 0 ? (n = e.prefix.slice(o)) : (i = i.slice(o)),
		new ff(n + i, t.suffixReplacementText, t.skippedSuffix, {
			startOffset: s.offsetAt(r),
			endOffset: t.range.endOffset,
		})
	)
}