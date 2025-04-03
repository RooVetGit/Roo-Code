
function vl(e, t) {
	let r = typeof e == "string" ? e : e.fsPath,
		n = typeof t == "string" ? t : t.fsPath
	return In.relative(r, n)
}