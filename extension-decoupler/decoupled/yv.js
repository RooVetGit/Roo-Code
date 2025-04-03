
	function YV(e, t, r = (i, s) => new Event(i, s), n = {}) {
		let i = r(e, n)
		t.dispatchEvent(i)
	}