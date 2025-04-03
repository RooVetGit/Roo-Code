
function Xl(e, t, r = !1) {
	let n = [...e]
	return n.length <= t
		? e
		: r
			? t <= 3
				? "..."
				: "..." + n.slice(3 - t).join("")
			: n.slice(0, Math.max(t - 3, 0)).join("") + "..."
}