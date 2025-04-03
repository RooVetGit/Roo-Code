
async function* XM(e, t) {
	let r = [],
		n = KM()
	for await (let i of Ebe(t)) {
		let { text: s, replacementStartLine: o, replacementOldText: a } = i
		if (
			((!Wn(o) || !Wn(a) || !Wn(s)) && JM(n) && (yield* hbe(n, r, e), (n = KM())),
			(n = ybe(n, i)),
			u0t(n, e),
			d0t(n))
		) {
			let l = zM(n),
				c = ZM(l, r),
				u = jM(l, c)
			yield {
				newChunkStart: {
					originalStartLine: n.startLineNumber,
					stagedStartLine: u.lineChange.originalStartLineNumber,
				},
			},
				(n.hasYieldedNewChunk = !0)
		}
		Wn(i.replacementText) ||
			((n.newTextBuffer += i.replacementText), yield { chunkContinue: { newText: vbe(n, e, 3, !1) } })
	}
	JM(n) && (yield* hbe(n, r, e))
}