
function Cve(e, t) {
	return Object.assign({}, ...t.map((r) => (r in e ? { [r]: e[r] } : {})))
}