
var ZF = class e extends cf {
	constructor(r, n) {
		super(n, "Show Internal Context")
		this._extension = r
	}
	static commandID = "vscode-augment.showWorkspaceContext"
	static textDocumentName = "Augment Workspace Context.txt"
	_documentUri = ea.Uri.file(e.textDocumentName).with({ scheme: "untitled" })
	async run() {
		let r = this._formatContext(),
			n = await ea.workspace.openTextDocument(this._documentUri)
		await ea.window.showTextDocument(n)
		let i = new ea.Range(new ea.Position(0, 0), new ea.Position(n.lineCount, 0)),
			s = new ea.WorkspaceEdit()
		s.replace(n.uri, i, r), await ea.workspace.applyEdit(s)
	}
	_formatContext() {
		let r = this._extension.workspaceManager
		if (r === void 0) return "no workspace manager"
		let n = r.getContextWithBlobNames(),
			i = `Augment workspace context
`,
			s = this._formatBlobs(r, n),
			o = this._formatChunks(n.recentChunks)
		return (
			i +
			s +
			`


` +
			o
		)
	}
	_formatBlobs(r, n) {
		let i = new Array(),
			s = new Set()
		for (let [c, u] of n.trackedPaths) for (let [f, p] of u) s.add(p)
		let o = new Map(),
			a = new Set()
		for (let c of n.blobNames) {
			let u = r.getAllPathInfo(c)
			for (let [f, p, g] of u) {
				let m = o.get(f)
				m === void 0 && ((m = new Map()), o.set(f, m)), m.set(g, [c, u.length])
			}
			u.length === 0 && !s.has(c) && a.add(c)
		}
		let l = new Map()
		for (let c of n.recentChunks) {
			let u = c.repoRoot,
				f = c.pathName,
				p = l.get(u)
			p === void 0 && ((p = new Map()), l.set(u, p)), p.set(f, (p.get(f) || 0) + 1)
		}
		for (let [c, u] of o) {
			let f = n.trackedPaths.get(c) || new Map(),
				p = u.size,
				g = f.size,
				m = l.get(c) || new Map()
			for (let b of m.keys()) f.has(b) || i.push(`    ${c}: ${b} has recent chunks but is not open`)
			let y = `Repo root ${c}: ${p} paths (${g} open)`
			i.push(""), i.push(y), i.push("=".repeat(y.length))
			let C = Array.from(f.keys())
			C.sort()
			for (let b of C) {
				let w = f.get(b),
					B = m.get(b) || 0
				i.push(`    ${w} -> ${b}: open, recent chunks: ${B}`)
			}
			C.length > 0 && i.push("")
			let v = Array.from(u.keys())
			v.sort()
			for (let b of v) {
				if (f.has(b)) continue
				let [w, B] = u.get(b),
					M = B === 1 ? "" : ` (x ${B})`
				i.push(`    ${w} -> ${b}${M}`)
			}
		}
		if (a.size > 0) for (let c of a) i.push(`unknown blob: ${c}`)
		return i.join(`
`)
	}
	_formatChunks(r) {
		let n = new Array(),
			i = "Recent chunks"
		if ((n.push(i), n.push("=".repeat(i.length)), r.length === 0))
			return (
				n.push("    (no recent chunks)"),
				n.join(`
`)
			)
		for (let s = 0; s < r.length; s++) {
			let o = r[s]
			n.push(""),
				n.push(`Chunk ${s + 1} of ${r.length}`),
				n.push(`    seq:      ${o.seq}`),
				n.push(`    uploaded: ${o.uploaded}`),
				n.push(`    repoRoot: ${o.repoRoot}`),
				n.push(`    pathName: ${o.pathName}`),
				n.push(`    blobName: ${o.blobName}`),
				n.push(`    start:    ${o.origStart}`),
				n.push(`    length:   ${o.origLength}`),
				n.push("======== chunk begin ========"),
				n.push(o.text),
				n.push("-------- chunk end ----------"),
				n.push("")
		}
		return n.join(`
`)
	}
}