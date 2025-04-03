
function ui(e) {
	return e?.state === "fresh" && e.changeType !== "noop"
}