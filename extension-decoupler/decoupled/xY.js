
function Xy() {
	let e = "",
		t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	for (let r = 0; r < 32; r++) e += t.charAt(Math.floor(Math.random() * t.length))
	return e
}