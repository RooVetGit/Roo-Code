
function dke(e) {
	if (typeof e != "object" || !e) return !1
	let t = e
	return (
		typeof t.path == "object" &&
		!!t.path &&
		typeof t.path.rootPath == "string" &&
		typeof t.path.relPath == "string" &&
		typeof t.originalCode == "string" &&
		typeof t.modifiedCode == "string"
	)
}