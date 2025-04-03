
function Vut(e, t = {}) {
	return e.split(qut).map((r) => {
		let n = r
				.trim()
				.split(Out)
				.filter((s) => s && !!s.trim()),
			i = []
		for (let s = 0, o = n.length; s < o; s += 1) {
			let a = n[s],
				l = !1,
				c = -1
			for (; !l && ++c < kme; ) {
				let u = RW[c],
					f = u.isMultiMatch(a)
				f && (i.push(new u(f, t)), (l = !0))
			}
			if (!l)
				for (c = -1; ++c < kme; ) {
					let u = RW[c],
						f = u.isSingleMatch(a)
					if (f) {
						i.push(new u(f, t))
						break
					}
				}
		}
		return i
	})
}