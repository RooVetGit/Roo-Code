
function Bme() {
	let e = Di.window.activeTextEditor
	if (!e) return []
	let { document: t, selection: r } = e,
		n = []
	return (
		r.isEmpty ||
			(n = Di.languages
				.getDiagnostics(t.uri)
				.filter((o) => o.range.intersection(r))
				.map((o) => ({
					location: {
						path: t.fileName,
						line_start: o.range.start.line,
						line_end: o.range.end.line,
					},
					char_start: 0,
					char_end: 0,
					blob_name: "",
					current_blob_name: "",
					message: o.message,
					severity: (() => {
						switch (o.severity) {
							case Di.DiagnosticSeverity.Error:
								return "ERROR"
							case Di.DiagnosticSeverity.Warning:
								return "WARNING"
							case Di.DiagnosticSeverity.Information:
								return "INFORMATION"
							case Di.DiagnosticSeverity.Hint:
								return "HINT"
							default:
								return "ERROR"
						}
					})(),
				}))),
		n
	)
}