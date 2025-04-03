
function $1e(e) {
	if (e === null) return !0
	var t = e.length
	return (t === 1 && e === "~") || (t === 4 && (e === "null" || e === "Null" || e === "NULL"))
}