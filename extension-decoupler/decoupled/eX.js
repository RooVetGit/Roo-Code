
async function Ex(e) {
	let t = [],
		r = await ai.readdir(e, { withFileTypes: !0 })
	for (let n of r) t.push([n.name, ime(n)])
	return t
}