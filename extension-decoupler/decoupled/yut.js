
function Yut(e, { ignoreFieldNorm: t = Dt.ignoreFieldNorm }) {
	e.forEach((r) => {
		let n = 1
		r.matches.forEach(({ key: i, norm: s, score: o }) => {
			let a = i ? i.weight : null
			n *= Math.pow(o === 0 && a ? Number.EPSILON : o, (a || 1) * (t ? 1 : s))
		}),
			(r.score = n)
	})
}