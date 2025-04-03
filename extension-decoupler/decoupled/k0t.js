
function K0t(e, t) {
	return e.message === t.message && e.severity === t.severity && e.range.isEqual(t.range)
}