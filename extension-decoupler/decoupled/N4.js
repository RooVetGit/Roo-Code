
function N4(e) {
	let t = ["checkout", ...e]
	return t[1] === "-b" && t.includes("-B") && (t[1] = qM(t, "-B")), mo(t)
}