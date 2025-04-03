
function m$(e) {
	return e != null && typeof e == "object" && ("rootPath" in e || "relPath" in e)
}