
function Du(e, t) {
	if (Qh(e)) {
		let i = t.getFolderRoot(e)
		return i === void 0 ? void 0 : new Je(i, vl(i, e))
	}
	let r = t.findBestWorkspaceRootMatch(e)
	if (r) {
		let i = r.qualifiedPathName.rootPath
		return new Je(i, e)
	}
	let n = Kd(t)
	if (n) return new Je(n, e)
}