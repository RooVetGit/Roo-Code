
function RNe(e, t) {
	var r, n, i
	for (r = 0, n = e.implicitTypes.length; r < n; r += 1) if (((i = e.implicitTypes[r]), i.resolve(t))) return !0
	return !1
}