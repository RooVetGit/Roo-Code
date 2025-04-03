
	function dte(e, t, r) {
		let n = t.position,
			i = ""
		for (
			bB(e[t.position] === '"'), t.position++;
			(i += xB((o) => o !== '"' && o !== "\\", e, t)), !(t.position >= e.length);

		) {
			let s = e[t.position]
			if ((t.position++, s === "\\")) {
				if (t.position >= e.length) {
					i += "\\"
					break
				}
				;(i += e[t.position]), t.position++
			} else {
				bB(s === '"')
				break
			}
		}
		return r ? i : e.slice(n, t.position)
	}