
function sg(e, t) {
	return e.filter((r) => r instanceof t).map((r) => r.suggestion)
}