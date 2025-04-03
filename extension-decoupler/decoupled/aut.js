
function Aut(e, t) {
	let r = e.filter((i) => {
		let s = i.split(".").pop()?.toLowerCase()
		return s && t.includes(s)
	})
	if (r.length === 0) return ""
	let n = { isDirectory: !0, children: new Map() }
	for (let i of r) {
		let o = Gn.workspace.asRelativePath(i).split(Sx.default.sep),
			a = n
		for (let l = 0; l < o.length - 1; l++) {
			let c = o[l]
			a.children.has(c) || a.children.set(c, { isDirectory: !0, children: new Map() }), (a = a.children.get(c))
		}
	}
	return n.children.size === 0 ? "" : _me(n)
}