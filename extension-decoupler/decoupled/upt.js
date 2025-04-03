
function Upt(e, t, { namespace: r }) {
	if (typeof e == "string") return e
	let n = (t && t.namespace) || ""
	return n.startsWith(r) ? n.substr(r.length + 1) : n || r
}