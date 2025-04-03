
	function Znt(e, t, r) {
		let n = t.reduce((s, o) => ((s[o] = e[o]), delete e[o], s), {}),
			i = Object.keys(e).reduce((s, o) => ((s[o] = e[o]), delete e[o], s), {})
		return Object.assign(e, n, { [r]: i }), e
	}