
function LC(e, t) {
	let r = new Set(t)
	return e.filter((n) => !r.has(n))
}