
function CC(e) {
	let t = Xxe.createHash("sha256")
	return t.update(e), t.digest("hex")
}