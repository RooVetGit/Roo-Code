
var x = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports),
	z2 = (e, t) => {
		for (var r in t) aI(e, r, { get: t[r], enumerable: !0 })
	},
	h$ = (e, t, r, n) => {
		if ((t && typeof t == "object") || typeof t == "function")
			for (let i of nke(t))
				!ske.call(e, i) &&
					i !== r &&
					aI(e, i, {
						get: () => t[i],
						enumerable: !(n = rke(t, i)) || n.enumerable,
					})
		return e
	}