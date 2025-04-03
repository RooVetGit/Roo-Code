
	function qit(e, t, r) {
		var n = t.length - 1
		if (n < r) return 0
		var i = j3(t[n])
		return i >= 0
			? (i > 0 && (e.lastNeed = i - 1), i)
			: --n < r || i === -2
				? 0
				: ((i = j3(t[n])),
					i >= 0
						? (i > 0 && (e.lastNeed = i - 2), i)
						: --n < r || i === -2
							? 0
							: ((i = j3(t[n])), i >= 0 ? (i > 0 && (i === 2 ? (i = 0) : (e.lastNeed = i - 3)), i) : 0))
	}