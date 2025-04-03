
	function Xnt(e, t, r) {
		return (e[r] = t.reduce((n, i) => ((n[i] = e[i]), delete e[i], n), {})), e
	}