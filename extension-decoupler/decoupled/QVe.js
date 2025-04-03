
function* qve(e, t = null) {
	let r = e.split("\0")
	for (let n = 0, i = r.length - 1; n < i; ) {
		let s = Ipt(r[n++]),
			o = r[n++],
			a = t
		if (
			o.includes(`
`)
		) {
			let l = hve(
				o,
				`
`,
			)
			;(a = l[0]), (o = l[1])
		}
		yield { file: s, key: a, value: o }
	}
}