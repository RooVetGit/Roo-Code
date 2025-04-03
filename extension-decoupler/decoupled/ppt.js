
function Ppt(e) {
	if (zve(e)) return e
	switch (typeof e) {
		case "string":
		case "undefined":
			return "soft"
	}
}