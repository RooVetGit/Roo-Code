
function _pt(e) {
	let t = new Vve()
	for (let r of qve(e)) t.addValue(r.file, String(r.key), r.value)
	return t
}