
	function Sit(e, t, r) {
		return typeof r != "number" && (r = 0), r + t.length > e.length ? !1 : e.indexOf(t, r) !== -1
	}