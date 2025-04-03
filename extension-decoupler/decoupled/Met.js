
function met(e) {
	return e.cause instanceof String ? String(e.cause) : e.cause instanceof Object ? JSON.stringify(e.cause) : ""
}