
function Tbe(e) {
	if (yo(e.uri)) {
		for (let t of oA.workspace.notebookDocuments) for (let r of t.getCells()) if (r.document === e) return t
	}
}