
function Fmt(e, t) {
	let r = isNaN(e),
		n = isNaN(t)
	return r !== n ? (r ? 1 : -1) : r ? obe(e, t) : 0
}