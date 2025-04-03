
function BNe(e) {
	var t, r, n
	if (((t = e.toString(16).toUpperCase()), e <= 255)) (r = "x"), (n = 2)
	else if (e <= 65535) (r = "u"), (n = 4)
	else if (e <= 4294967295) (r = "U"), (n = 8)
	else throw new ko("code point within a string may not be greater than 0xFFFFFFFF")
	return "\\" + r + Ui.repeat("0", n - t.length) + t
}