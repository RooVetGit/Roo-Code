
function $p(e) {
	let t
	return new Promise((r) => {
		t = e((n) => {
			t.dispose(), r(n)
		})
	})
}