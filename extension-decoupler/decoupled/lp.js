
function LP(e) {
	var t
	;(t = e.input.charCodeAt(e.position)),
		t === 10
			? e.position++
			: t === 13
				? (e.position++, e.input.charCodeAt(e.position) === 10 && e.position++)
				: Xe(e, "a line break is expected"),
		(e.line += 1),
		(e.lineStart = e.position),
		(e.firstTabInLine = -1)
}