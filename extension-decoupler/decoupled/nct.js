
function nCt(e, t) {
	let r = new Set(t.unknownBlobNames.concat(t.nonindexedBlobNames)),
		n = []
	for (let i of e) r.has(i) || n.push(i)
	return n
}