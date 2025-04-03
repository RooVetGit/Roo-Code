
	function R4e(e, t) {
		let r = null,
			n = null,
			i = null,
			s = null
		for (;;) {
			if (e[t.position] === 13 && e[t.position + 1] === 10)
				return r === null ? "failure" : { name: r, filename: n, contentType: i, encoding: s }
			let o = r0((a) => a !== 10 && a !== 13 && a !== 58, e, t)
			if (((o = VO(o, !0, !0, (a) => a === 9 || a === 32)), !v4e.test(o.toString()) || e[t.position] !== 58))
				return "failure"
			switch ((t.position++, r0((a) => a === 32 || a === 9, e, t), y4e(o))) {
				case "content-disposition": {
					if (((r = n = null), !DB(e, w4e, t) || ((t.position += 17), (r = Ute(e, t)), r === null)))
						return "failure"
					if (DB(e, Lte, t)) {
						let a = t.position + Lte.length
						if (
							(e[a] === 42 && ((t.position += 1), (a += 1)),
							e[a] !== 61 || e[a + 1] !== 34 || ((t.position += 12), (n = Ute(e, t)), n === null))
						)
							return "failure"
					}
					break
				}
				case "content-type": {
					let a = r0((l) => l !== 10 && l !== 13, e, t)
					;(a = VO(a, !1, !0, (l) => l === 9 || l === 32)), (i = Pte(a))
					break
				}
				case "content-transfer-encoding": {
					let a = r0((l) => l !== 10 && l !== 13, e, t)
					;(a = VO(a, !1, !0, (l) => l === 9 || l === 32)), (s = Pte(a))
					break
				}
				default:
					r0((a) => a !== 10 && a !== 13, e, t)
			}
			if (e[t.position] !== 13 && e[t.position + 1] !== 10) return "failure"
			t.position += 2
		}
	}