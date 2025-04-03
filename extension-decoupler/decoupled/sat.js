
function SAt(e, t, r) {
	let n = r.includes("deleted"),
		i = r.includes("tag") || /^refs\/tags/.test(e),
		s = !r.includes("new")
	return {
		deleted: n,
		tag: i,
		branch: !i,
		new: !s,
		alreadyUpdated: s,
		local: e,
		remote: t,
	}
}