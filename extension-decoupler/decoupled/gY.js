
function Gy(e) {
	return e
		.filter((n) => n.kind === oA.NotebookCellKind.Code)
		.map((n) => n.document.getText())
		.join(l_)
}