
function Rwe(e) {
	let t = e.get("sessionId")
	return (t === void 0 || !d3(t)) && ((t = Eh()), e.update("sessionId", t)), t
}