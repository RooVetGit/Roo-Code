
function ove(e, t) {
	if (e.length < 1 || e.length > 2) throw new Xd(void 0, "binary", zmt)
	if (e.some(jmt))
		if (t) console.warn(sve)
		else throw new Xd(void 0, "binary", sve)
	let [n, i] = e
	return { binary: n, prefix: i }
}