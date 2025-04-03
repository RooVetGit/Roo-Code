
	function Jj(e, t, r) {
		var n, i, s
		return (
			e === "left" ? ((n = t.previousSibling), (i = / $/)) : ((n = t.nextSibling), (i = /^ /)),
			n &&
				(n.nodeType === 3
					? (s = i.test(n.nodeValue))
					: r.preformattedCode && n.nodeName === "CODE"
						? (s = !1)
						: n.nodeType === 1 && !AU(n) && (s = i.test(n.textContent))),
			s
		)
	}