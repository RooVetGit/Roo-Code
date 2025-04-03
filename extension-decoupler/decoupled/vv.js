
function Vv(e, t) {
	var r = e.charCodeAt(t),
		n
	return r >= 55296 && r <= 56319 && t + 1 < e.length && ((n = e.charCodeAt(t + 1)), n >= 56320 && n <= 57343)
		? (r - 55296) * 1024 + n - 56320 + 65536
		: r
}