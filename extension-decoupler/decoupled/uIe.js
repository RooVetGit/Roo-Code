
	function uie(e) {
		return Object.fromEntries(Object.entries(e).map(([t, r]) => [t.toLocaleLowerCase(), r]))
	}