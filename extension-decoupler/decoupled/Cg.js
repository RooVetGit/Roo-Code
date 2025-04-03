
function cg(e, t, r, n) {
	let i = 0
	for (let s of r)
		if ((e.log(t, `  ${s}`), i++, n !== void 0 && i >= n)) {
			e.log(t, "  ...")
			break
		}
}