
function oCt(e) {
	return Object.prototype.hasOwnProperty.call(e.event, "notebook") ? e.event.notebook : e.event.document
}