
function jx(e) {
	return (Array.isArray(e) ? Buffer.concat(e) : e).toString("utf-8")
}