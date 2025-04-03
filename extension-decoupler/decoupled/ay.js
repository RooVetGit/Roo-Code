
function Ay(e, t = "") {
	let r = []
	if (typeof e != "object" || e === null) return LAe(e)
	for (let [n, i] of Object.entries(e))
		if (Array.isArray(i)) {
			r.push(`${t}${n}: (array) ${i.length} (array length) ${JSON.stringify(i).length} (char length)`)
			let s = 20
			i.slice(0, s).forEach((o, a) => {
				r.push(`${t}  [${a}]: ${Ay(o, t + "  ")}`)
			}),
				i.length > s && r.push(`${t}  ${i.length - s} more items...`)
		} else
			typeof i == "object" && i !== null
				? (r.push(
						`${t}${n}: (object) ${Object.keys(i).length} (object size) ${
							JSON.stringify(i).length
						} (char length)`,
					),
					r.push(Ay(i, t + "  ")))
				: r.push(`${t}${n}: ${LAe(i)}`)
	return r.join(`
`)
}