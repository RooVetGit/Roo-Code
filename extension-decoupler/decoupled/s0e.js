
function s0e(e, t, r) {
	return new go(e, { ...qW, ...r.fuseInit, keys: ["name"] }).search(`${t}$`, r.fuseSearch).map((s) => s.item)
}