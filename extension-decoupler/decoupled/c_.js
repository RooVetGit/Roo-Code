
var $G = (e) => {
		let t = new Map()
		for (let r of e.filter(Boolean)) t.set(r.result.suggestionId, r)
		return Array.from(t.values())
	},
	C_ =
		(...e) =>
		(t) =>
			e.some((r) => r(t))