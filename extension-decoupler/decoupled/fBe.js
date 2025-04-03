
function Fbe(e, t) {
	let r = [],
		n = Ri.workspace.onDidChangeTextDocument((i) => {
			i.document.uri.toString() === e.document.uri.toString() &&
				(t.forEach((s) => s.dispose()), r.forEach((s) => void s.dispose()))
		})
	return (
		r.push(n),
		{
			dispose: () => {
				r.forEach((i) => void i.dispose())
			},
		}
	)
}