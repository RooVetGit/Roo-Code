
	function Ete(e) {
		return (
			(e[0] === "	" ||
				e[0] === " " ||
				e[e.length - 1] === "	" ||
				e[e.length - 1] === " " ||
				e.includes(`
`) ||
				e.includes("\r") ||
				e.includes("\0")) === !1
		)
	}