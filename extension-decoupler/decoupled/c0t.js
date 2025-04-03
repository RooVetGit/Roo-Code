
function c0t(e, t) {
	var r
	let n = new r0t(),
		i = xve((e && (typeof e == "string" ? { baseDir: e } : e)) || {}, t)
	if (!tG(i.baseDir)) throw new Vmt(i, "Cannot use simple-git on a directory that does not exist")
	return (
		Array.isArray(i.config) && n.add(Kmt(i.config)),
		n.add(Ymt(i.unsafe)),
		n.add(a0t()),
		n.add(Jmt(i.completion)),
		i.abort && n.add(Hmt(i.abort)),
		i.progress && n.add(n0t(i.progress)),
		i.timeout && n.add(o0t(i.timeout)),
		i.spawnOptions && n.add(s0t(i.spawnOptions)),
		n.add(ave(t0t(!0))),
		i.errors && n.add(ave(i.errors)),
		Zmt(n, i.binary, (r = i.unsafe) == null ? void 0 : r.allowUnsafeCustomBinary),
		new l0t(i, n)
	)
}