
function Cmt(e) {
	let t = {}
	return rbe(e, ([r]) => (t[r] = { name: r })), Object.values(t)
}