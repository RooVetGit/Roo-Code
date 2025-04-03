
function Y0t(e, t) {
	let r = t.text === void 0 ? "" : t.text,
		n
	return (
		t.rangeOffset !== void 0 && t.rangeLength !== void 0
			? (n = { start: t.rangeOffset, end: t.rangeOffset + t.rangeLength })
			: (n = {
					start: e.offsetAt(t.range.start),
					end: e.offsetAt(t.range.end),
				}),
		{ text: r, range: n }
	)
}