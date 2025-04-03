
function WAe(e) {
	return e.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}