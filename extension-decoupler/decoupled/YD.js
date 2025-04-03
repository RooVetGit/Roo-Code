
function Yd(e, t) {
	let r = vl(e, t)
	return r === "." ? "" : r.length > 0 && !r.endsWith(In.sep) ? r + In.sep : r
}