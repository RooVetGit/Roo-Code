
function L1e(e) {
	var t = {}
	return (
		e !== null &&
			Object.keys(e).forEach(function (r) {
				e[r].forEach(function (n) {
					t[String(n)] = r
				})
			}),
		t
	)
}