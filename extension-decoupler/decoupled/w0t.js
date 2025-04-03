
function W0t(e, t) {
	return (r) => {
		let n = performance.now() - e
		return t(Math.round(n)), r
	}
}