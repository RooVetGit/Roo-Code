
var R1 = class e extends z {
	static _maxDiagnosticsPerFile = 10
	_diagnostics = new Map()
	_logger = X("DiagnosticsManager")
	constructor() {
		super(),
			this.addDisposable(
				EC.languages.onDidChangeDiagnostics((t) => {
					let r = new Date()
					for (let n of t.uris) {
						if (yo(n)) continue
						let i = this._diagnostics.get(n.path),
							s = EC.languages.getDiagnostics(n).slice(0, e._maxDiagnosticsPerFile),
							o = []
						for (let a of s) {
							if (
								a.severity !== EC.DiagnosticSeverity.Error &&
								a.severity !== EC.DiagnosticSeverity.Warning
							)
								continue
							let l = i?.find((c) => K0t(c.diagnostic, a))
							l === void 0 ? o.push(new i8(n, a, r)) : o.push(l)
						}
						this._diagnostics.set(n.path, o)
					}
				}),
			)
	}
	async getMostRecentDiagnostics(t, r, n = void 0) {
		let s = Array.from(this._diagnostics.entries())
				.flatMap(([c, u]) => (n !== void 0 && !c.startsWith(n) ? [] : u))
				.sort((c, u) => {
					let f = u.time.getTime() - c.time.getTime()
					return f !== 0 ? f : c.diagnostic.severity - u.diagnostic.severity
				}),
			o = new Map(),
			a = [],
			l = new Map()
		for (let c of s) {
			if (c.diagnostic.range.start.line < 0 || c.diagnostic.range.start.line > c.diagnostic.range.end.line) {
				this._logger.debug(
					`Ignoring invalid diagnostic ${c.diagnostic.message} in ${c.uri.path} at ${c.diagnostic.range.start.line}:${c.diagnostic.range.end.line}`,
				)
				continue
			}
			let u = o.get(c.uri.path) ?? 0
			if (u < r) {
				if (!l.has(c.uri.path))
					try {
						l.set(c.uri.path, await ho(c.uri))
					} catch {
						this._logger.debug(`Failed to open document ${c.uri.fsPath}.`)
						continue
					}
				let f = l.get(c.uri.path)
				if (!f) continue
				if (c.diagnostic.range.end.line >= f.lineCount) {
					this._logger.debug(
						`Ignoring stale diagnostic ${c.diagnostic.message} in ${c.uri.path} at ${c.diagnostic.range.start.line}:${c.diagnostic.range.end.line}`,
					)
					continue
				}
				let p = f.offsetAt(c.diagnostic.range.start),
					g = f.offsetAt(c.diagnostic.range.end)
				if ((a.push(new s8(c.uri, c.diagnostic, p, g)), o.set(c.uri.path, u + 1), a.length >= t)) break
			}
		}
		return a
	}
}