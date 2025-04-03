
function DM(e) {
	return (typeof e == "string" && parseInt(e.replace(/^\D+/g, ""), 10)) || 0
}