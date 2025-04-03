
function MAt(e, t) {
	let r = t.trim()
	switch (" ") {
		case r.charAt(2):
			return n(r.charAt(0), r.charAt(1), r.substr(3))
		case r.charAt(1):
			return n(" ", r.charAt(0), r.substr(2))
		default:
			return
	}
	function n(i, s, o) {
		let a = `${i}${s}`,
			l = REe.get(a)
		l && l(e, o), a !== "##" && a !== "!!" && e.files.push(new TEe(o, i, s))
	}
}