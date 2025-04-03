
	function Kj(e, t, r) {
		return (e && e.parentNode === t) || r(t)
			? t.nextSibling || t.parentNode
			: t.firstChild || t.nextSibling || t.parentNode
	}