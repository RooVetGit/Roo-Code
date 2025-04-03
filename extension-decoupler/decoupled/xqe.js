
function XQe(e, t) {
	var r,
		n,
		i = RP,
		s = !1,
		o = !1,
		a = t,
		l = 0,
		c = !1,
		u,
		f
	if (((f = e.input.charCodeAt(e.position)), f === 124)) n = !1
	else if (f === 62) n = !0
	else return !1
	for (e.kind = "scalar", e.result = ""; f !== 0; )
		if (((f = e.input.charCodeAt(++e.position)), f === 43 || f === 45))
			RP === i ? (i = f === 43 ? HY : OQe) : Xe(e, "repeat of a chomping mode identifier")
		else if ((u = $Qe(f)) >= 0)
			u === 0
				? Xe(e, "bad explicit indentation width of a block scalar; it cannot be less than one")
				: o
					? Xe(e, "repeat of an indentation width identifier")
					: ((a = t + u - 1), (o = !0))
		else break
	if (Wg(f)) {
		do f = e.input.charCodeAt(++e.position)
		while (Wg(f))
		if (f === 35)
			do f = e.input.charCodeAt(++e.position)
			while (!zc(f) && f !== 0)
	}
	for (; f !== 0; ) {
		for (LP(e), e.lineIndent = 0, f = e.input.charCodeAt(e.position); (!o || e.lineIndent < a) && f === 32; )
			e.lineIndent++, (f = e.input.charCodeAt(++e.position))
		if ((!o && e.lineIndent > a && (a = e.lineIndent), zc(f))) {
			l++
			continue
		}
		if (e.lineIndent < a) {
			i === HY
				? (e.result += Ui.repeat(
						`
`,
						s ? 1 + l : l,
					))
				: i === RP &&
					s &&
					(e.result += `
`)
			break
		}
		for (
			n
				? Wg(f)
					? ((c = !0),
						(e.result += Ui.repeat(
							`
`,
							s ? 1 + l : l,
						)))
					: c
						? ((c = !1),
							(e.result += Ui.repeat(
								`
`,
								l + 1,
							)))
						: l === 0
							? s && (e.result += " ")
							: (e.result += Ui.repeat(
									`
`,
									l,
								))
				: (e.result += Ui.repeat(
						`
`,
						s ? 1 + l : l,
					)),
				s = !0,
				o = !0,
				l = 0,
				r = e.position;
			!zc(f) && f !== 0;

		)
			f = e.input.charCodeAt(++e.position)
		Qf(e, r, e.position, !1)
	}
	return !0
}