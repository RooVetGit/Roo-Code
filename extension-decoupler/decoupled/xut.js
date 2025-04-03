
function Xut(e) {
	let t = (o) => e.getAllPathNames(o)[0],
		n = e
			.getContextWithBlobNames()
			.blobNames.map(t)
			.filter((o) => o !== void 0),
		i = new Map(
			n.map((o) => {
				let a = { rootPath: o.rootPath, relPath: _c(o.relPath) }
				return [Bs(a), a]
			}),
		),
		s = Array.from(i.values())
	return { files: n, folders: s }
}