
function A0t(e, t) {
	let r = t.getCells().find((n) => n.document === e)
	return r ? r.kind === oA.NotebookCellKind.Code : !1
}