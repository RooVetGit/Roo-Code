
function CY(e) {
	let t = "([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d"
	return e.precision ? (t = `${t}\\.\\d{${e.precision}}`) : e.precision == null && (t = `${t}(\\.\\d+)?`), t
}