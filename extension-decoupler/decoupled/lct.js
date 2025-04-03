
function lCt(e) {
	if (
		!(e.mtime === void 0 || typeof e.mtime != "number" || !e.mtime) &&
		!(e.name === void 0 || typeof e.name != "string" || !e.name)
	)
		return { mtime: e.mtime, name: e.name }
}