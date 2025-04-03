
async function Awe(e, t) {
	let r = new Map(),
		n = X(`MtimeCache[${e}]`),
		i = $t(t, pf.cacheFileName)
	n.info(`reading blob name cache from ${i}`)
	try {
		let s = 0,
			o = await Fr(i),
			a = JSON.parse(o)
		if (a.namingVersion === void 0 || a.namingVersion !== hE)
			n.info(`blob naming version ${a.namingVersion} !== ${hE}`)
		else if (Array.isArray(a.entries))
			for (let [l, c] of a.entries) {
				let u = lCt(c)
				u !== void 0 && (r.set(l, { mtime: u.mtime, name: u.name }), s++)
			}
		n.info(`read ${s} entries from ${i}`)
	} catch (s) {
		let o = Ye(s)
		s instanceof Error && "code" in s && s.code === "ENOENT"
			? n.info(`no blob name cache found at ${i} (probably new source folder); error = ${o}`)
			: n.error(`failed to read blob name cache ${i}: ${o}`)
	}
	return r
}