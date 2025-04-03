
function ryt(e, t, r) {
	let n = t.result.existingCode,
		i = t.result.suggestedCode,
		s = []
	for (let o of t.result.diffSpans) {
		let a = n.slice(o.original.start, o.original.stop),
			l = i.slice(o.updated.start, o.updated.stop),
			c = Na.determineChangeType(a, l),
			u = r ? o.original : o.updated,
			f = t.result.charStart + u.start,
			p = t.result.charStart + u.stop
		c === (r ? "insertion" : "deletion") &&
			e.positionAt(f).character === 0 &&
			l.endsWith(`
`) &&
			(f = t.result.charStart + u.start - 1),
			s.push([c, new qe.Range(e.positionAt(f), e.positionAt(p))])
	}
	return s
}