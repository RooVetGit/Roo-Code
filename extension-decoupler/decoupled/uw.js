
function UW(e) {
	let t = new Map()
	return (
		e.forEach((r) => {
			let n = Bs({ rootPath: r.repoRoot, relPath: r.pathName })
			t.set(n, r)
		}),
		Array.from(t.values())
	)
}