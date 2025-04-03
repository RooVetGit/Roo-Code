
function MCe(e, t, r) {
	return !t || !String(t).replace(/\s*/, "")
		? r
			? (n, ...i) => {
					e(n, ...i), r(n, ...i)
				}
			: e
		: (n, ...i) => {
				e(`%s ${n}`, t, ...i), r && r(n, ...i)
			}
}