
function E0t(e) {
	if (e.startsWith("A") || e.startsWith("=")) return !0
	if (e.startsWith("B")) return !1
	throw new Error(`Incorrect rating: ${e}`)
}