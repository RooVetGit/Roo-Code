
async function E_(e) {
	for (let [t, r] of Object.entries(P0t)) {
		let n = await yk(e, r.name, r.type)
		if (n !== void 0) return { root: n, toolName: t }
	}
}