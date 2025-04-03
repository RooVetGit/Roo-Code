
function Apt(e, t) {
	let r = new Tve(e),
		n = e ? kve : Rve
	return (
		t_(t).forEach((i) => {
			let s = i.replace(n, "")
			r.paths.push(s), (Mve.test(s) ? r.folders : r.files).push(s)
		}),
		r
	)
}