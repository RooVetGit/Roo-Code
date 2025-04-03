
function LAe(e) {
	return typeof e == "string"
		? `${e.length} (string length)`
		: typeof e == "boolean" || e === null || typeof e == "number"
			? "1"
			: "N/A"
}