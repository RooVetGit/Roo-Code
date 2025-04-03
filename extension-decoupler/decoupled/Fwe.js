
function fwe(e) {
	return tf(e)
		? e.getCells().map((t) => t.document.getText()).join(`
`)
		: e.getText()
}