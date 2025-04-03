
async function pyt(e, t, r, n) {
	let i = await e.getMostRecentDiagnostics(fyt, hyt, t),
		s = new Map()
	return (
		await Promise.all(
			i.map(async (a) => {
				let l = a.uri.path
				t && l.startsWith(t) && (l = l.substring(t.length))
				let c
				switch (a.diagnostic.severity) {
					case Ys.DiagnosticSeverity.Error:
						c = "ERROR"
						break
					case Ys.DiagnosticSeverity.Warning:
						c = "WARNING"
						break
					case Ys.DiagnosticSeverity.Information:
						c = "INFORMATION"
						break
					case Ys.DiagnosticSeverity.Hint:
						c = "HINT"
						break
				}
				s.has(l) || s.set(l, r.calculateNoThrow(l, (await ho(a.uri.fsPath)).getText()))
				let u = s.get(l)
				if (!u) return
				let f = n.safeResolvePathName(a.uri)
				if (!f) return
				let p = n.getBlobName(f)
				return p
					? {
							location: {
								path: l,
								line_start: a.diagnostic.range.start.line,
								line_end: a.diagnostic.range.end.line,
							},
							message: a.diagnostic.message,
							severity: c,
							current_blob_name: u,
							blob_name: p,
							char_start: a.charStart,
							char_end: a.charEnd,
						}
					: void 0
			}),
		)
	).filter((a) => a !== void 0)
}