
function Nh(e, t) {
	let r = vl(e, t)
	if (!(r === ".." || r.startsWith(".." + In.sep) || r.startsWith(".." + In.posix.sep))) return r
}