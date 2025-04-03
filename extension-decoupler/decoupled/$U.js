
function $u(e) {
	return new Rn(e.start.line, e.end.line + (e.end.character > 0 ? 1 : 0))
}