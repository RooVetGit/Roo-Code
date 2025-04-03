
function jNe(e) {
	return (
		e !== null &&
		typeof e == "object" &&
		"code" in e &&
		"stderr" in e &&
		"stdout" in e &&
		"message" in e &&
		"name" in e
	)
}