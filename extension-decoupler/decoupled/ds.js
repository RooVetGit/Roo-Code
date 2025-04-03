
function Ds(e, t) {
	return t && t.lineCount < e.stop
		? (j0t.warn(`LineRange[${e.start}, ${e.stop}) is out of bounds for document ${t.uri.path}.`),
			new a8.Range(e.start, 0, t.lineCount, 0))
		: new a8.Range(e.start, 0, e.stop, 0)
}