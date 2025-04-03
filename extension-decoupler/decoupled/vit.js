
	function Vit(e, t, r) {
		if ((t[0] & 192) !== 128) return (e.lastNeed = 0), "\uFFFD"
		if (e.lastNeed > 1 && t.length > 1) {
			if ((t[1] & 192) !== 128) return (e.lastNeed = 1), "\uFFFD"
			if (e.lastNeed > 2 && t.length > 2 && (t[2] & 192) !== 128) return (e.lastNeed = 2), "\uFFFD"
		}
	}