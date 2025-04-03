
	var l5 = function (e, t, r) {
			if (!e) throw new Error("WebStorage not available.")
			var n
			if (
				(r === null ? (n = e.removeItem(t)) : ((r = $.encode64(JSON.stringify(r))), (n = e.setItem(t, r))),
				typeof n < "u" && n.rval !== !0)
			) {
				var i = new Error(n.error.message)
				throw ((i.id = n.error.id), (i.name = n.error.name), i)
			}
		},
		c5 = function (e, t) {
			if (!e) throw new Error("WebStorage not available.")
			var r = e.getItem(t)
			if (e.init)
				if (r.rval === null) {
					if (r.error) {
						var n = new Error(r.error.message)
						throw ((n.id = r.error.id), (n.name = r.error.name), n)
					}
					r = null
				} else r = r.rval
			return r !== null && (r = JSON.parse($.decode64(r))), r
		},
		kje = function (e, t, r, n) {
			var i = c5(e, t)
			i === null && (i = {}), (i[r] = n), l5(e, t, i)
		},
		Mje = function (e, t, r) {
			var n = c5(e, t)
			return n !== null && (n = r in n ? n[r] : null), n
		},
		Fje = function (e, t, r) {
			var n = c5(e, t)
			if (n !== null && r in n) {
				delete n[r]
				var i = !0
				for (var s in n) {
					i = !1
					break
				}
				i && (n = null), l5(e, t, n)
			}
		},
		Qje = function (e, t) {
			l5(e, t, null)
		},
		tT = function (e, t, r) {
			var n = null
			typeof r > "u" && (r = ["web", "flash"])
			var i,
				s = !1,
				o = null
			for (var a in r) {
				i = r[a]
				try {
					if (i === "flash" || i === "both") {
						if (t[0] === null) throw new Error("Flash local storage not available.")
						;(n = e.apply(this, t)), (s = i === "flash")
					}
					;(i === "web" || i === "both") && ((t[0] = localStorage), (n = e.apply(this, t)), (s = !0))
				} catch (l) {
					o = l
				}
				if (s) break
			}
			if (!s) throw o
			return n
		}