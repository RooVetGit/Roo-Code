
	function _s(e, t) {
		if (!(this instanceof _s)) return new _s(e, t)
		if ((t && t in Bpe && (t = null), t && !(t in wa))) throw new Error("Unknown model: " + t)
		var r, n
		if (e == null) (this.model = "rgb"), (this.color = [0, 0, 0]), (this.valpha = 1)
		else if (e instanceof _s) (this.model = e.model), (this.color = e.color.slice()), (this.valpha = e.valpha)
		else if (typeof e == "string") {
			var i = lx.get(e)
			if (i === null) throw new Error("Unable to parse color from string: " + e)
			;(this.model = i.model),
				(n = wa[this.model].channels),
				(this.color = i.value.slice(0, n)),
				(this.valpha = typeof i.value[n] == "number" ? i.value[n] : 1)
		} else if (e.length) {
			;(this.model = t || "rgb"), (n = wa[this.model].channels)
			var s = NH.call(e, 0, n)
			;(this.color = QH(s, n)), (this.valpha = typeof e[n] == "number" ? e[n] : 1)
		} else if (typeof e == "number")
			(e &= 16777215),
				(this.model = "rgb"),
				(this.color = [(e >> 16) & 255, (e >> 8) & 255, e & 255]),
				(this.valpha = 1)
		else {
			this.valpha = 1
			var o = Object.keys(e)
			"alpha" in e && (o.splice(o.indexOf("alpha"), 1), (this.valpha = typeof e.alpha == "number" ? e.alpha : 0))
			var a = o.sort().join("")
			if (!(a in FH)) throw new Error("Unable to parse color from object: " + JSON.stringify(e))
			this.model = FH[a]
			var l = wa[this.model].labels,
				c = []
			for (r = 0; r < l.length; r++) c.push(e[l[r]])
			this.color = QH(c)
		}
		if (UR[this.model])
			for (n = wa[this.model].channels, r = 0; r < n; r++) {
				var u = UR[this.model][r]
				u && (this.color[r] = u(this.color[r]))
			}
		;(this.valpha = Math.max(0, Math.min(1, this.valpha))), Object.freeze && Object.freeze(this)
	}