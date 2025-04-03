
function Zo(e, t, r, n = !0) {
	return (
		Nu(r).forEach((i) => {
			for (let s = t_(i, n), o = 0, a = s.length; o < a; o++) {
				let l = (c = 0) => {
					if (!(o + c >= a)) return s[o + c]
				}
				t.some(({ parse: c }) => c(l, e))
			}
		}),
		e
	)
}