
	function c4e(e) {
		let t = e,
			r = { position: 0 },
			n = [],
			i = ""
		for (; r.position < t.length; ) {
			if (((i += np((s) => s !== '"' && s !== ",", t, r)), r.position < t.length))
				if (t.charCodeAt(r.position) === 34) {
					if (((i += AWe(t, r)), r.position < t.length)) continue
				} else ip(t.charCodeAt(r.position) === 44), r.position++
			;(i = mWe(i, !0, !0, (s) => s === 9 || s === 32)), n.push(i), (i = "")
		}
		return n
	}