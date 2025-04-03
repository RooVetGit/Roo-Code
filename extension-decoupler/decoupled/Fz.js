
	function Fz(e) {
		return e.replace(/[a-z][A-Z]/g, (t) => t.charAt(0) + "-" + t.charAt(1)).toLowerCase()
	}