
async function* Cbe(e, t) {
	let r = [],
		n = KM(),
		i = e.split(`
`)
	for await (let s of Ebe(t)) {
		let { replacementStartLine: o, replacementOldText: a } = s
		if ((!Wn(o) || !Wn(a)) && JM(n)) {
			let l = zM(n),
				c = n.currOffset ?? ZM(l, r)
			r.push(l)
			let u = jM(l, c)
			;(i = gbe([...i], u)), (n = KM())
		}
		if (((n = ybe(n, s)), Abe(n))) {
			let c = n.oldText.replaceAll(/\n$/g, "").split(`
`)[0]
			n.startLineNumber = s_(e, n.startLineNumber, c, 20)
		}
		if (mbe(n)) {
			let l = n.oldText.replaceAll(/\n$/g, "").split(`
`),
				c = l[l.length - 1]
			n.endLineNumber = s_(e, n.endLineNumber, c, 20) + 1
		}
		if (JM(n)) {
			let l = zM(n)
			n.currOffset = n.currOffset ?? ZM(l, r)
			let c = jM(l, n.currOffset)
			yield gbe([...i], c).join(`
`)
		}
	}
}