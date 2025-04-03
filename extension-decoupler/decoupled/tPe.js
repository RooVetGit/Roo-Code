
var Tpe = x((QTt, Dpe) => {
	"use strict"
	var lx = mpe(),
		wa = Spe(),
		NH = [].slice,
		Bpe = ["keyword", "gray", "hex"],
		FH = {}
	Object.keys(wa).forEach(function (e) {
		FH[NH.call(wa[e].labels).sort().join("")] = e
	})
	var UR = {}
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
	_s.prototype = {
		toString: function () {
			return this.string()
		},
		toJSON: function () {
			return this[this.model]()
		},
		string: function (e) {
			var t = this.model in lx.to ? this : this.rgb()
			t = t.round(typeof e == "number" ? e : 1)
			var r = t.valpha === 1 ? t.color : t.color.concat(this.valpha)
			return lx.to[t.model](r)
		},
		percentString: function (e) {
			var t = this.rgb().round(typeof e == "number" ? e : 1),
				r = t.valpha === 1 ? t.color : t.color.concat(this.valpha)
			return lx.to.rgb.percent(r)
		},
		array: function () {
			return this.valpha === 1 ? this.color.slice() : this.color.concat(this.valpha)
		},
		object: function () {
			for (var e = {}, t = wa[this.model].channels, r = wa[this.model].labels, n = 0; n < t; n++)
				e[r[n]] = this.color[n]
			return this.valpha !== 1 && (e.alpha = this.valpha), e
		},
		unitArray: function () {
			var e = this.rgb().color
			return (e[0] /= 255), (e[1] /= 255), (e[2] /= 255), this.valpha !== 1 && e.push(this.valpha), e
		},
		unitObject: function () {
			var e = this.rgb().object()
			return (e.r /= 255), (e.g /= 255), (e.b /= 255), this.valpha !== 1 && (e.alpha = this.valpha), e
		},
		round: function (e) {
			return (e = Math.max(e || 0, 0)), new _s(this.color.map(slt(e)).concat(this.valpha), this.model)
		},
		alpha: function (e) {
			return arguments.length ? new _s(this.color.concat(Math.max(0, Math.min(1, e))), this.model) : this.valpha
		},
		red: oi("rgb", 0, qi(255)),
		green: oi("rgb", 1, qi(255)),
		blue: oi("rgb", 2, qi(255)),
		hue: oi(["hsl", "hsv", "hsl", "hwb", "hcg"], 0, function (e) {
			return ((e % 360) + 360) % 360
		}),
		saturationl: oi("hsl", 1, qi(100)),
		lightness: oi("hsl", 2, qi(100)),
		saturationv: oi("hsv", 1, qi(100)),
		value: oi("hsv", 2, qi(100)),
		chroma: oi("hcg", 1, qi(100)),
		gray: oi("hcg", 2, qi(100)),
		white: oi("hwb", 1, qi(100)),
		wblack: oi("hwb", 2, qi(100)),
		cyan: oi("cmyk", 0, qi(100)),
		magenta: oi("cmyk", 1, qi(100)),
		yellow: oi("cmyk", 2, qi(100)),
		black: oi("cmyk", 3, qi(100)),
		x: oi("xyz", 0, qi(100)),
		y: oi("xyz", 1, qi(100)),
		z: oi("xyz", 2, qi(100)),
		l: oi("lab", 0, qi(100)),
		a: oi("lab", 1),
		b: oi("lab", 2),
		keyword: function (e) {
			return arguments.length ? new _s(e) : wa[this.model].keyword(this.color)
		},
		hex: function (e) {
			return arguments.length ? new _s(e) : lx.to.hex(this.rgb().round().color)
		},
		rgbNumber: function () {
			var e = this.rgb().color
			return ((e[0] & 255) << 16) | ((e[1] & 255) << 8) | (e[2] & 255)
		},
		luminosity: function () {
			for (var e = this.rgb().color, t = [], r = 0; r < e.length; r++) {
				var n = e[r] / 255
				t[r] = n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
			}
			return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]
		},
		contrast: function (e) {
			var t = this.luminosity(),
				r = e.luminosity()
			return t > r ? (t + 0.05) / (r + 0.05) : (r + 0.05) / (t + 0.05)
		},
		level: function (e) {
			var t = this.contrast(e)
			return t >= 7.1 ? "AAA" : t >= 4.5 ? "AA" : ""
		},
		isDark: function () {
			var e = this.rgb().color,
				t = (e[0] * 299 + e[1] * 587 + e[2] * 114) / 1e3
			return t < 128
		},
		isLight: function () {
			return !this.isDark()
		},
		negate: function () {
			for (var e = this.rgb(), t = 0; t < 3; t++) e.color[t] = 255 - e.color[t]
			return e
		},
		lighten: function (e) {
			var t = this.hsl()
			return (t.color[2] += t.color[2] * e), t
		},
		darken: function (e) {
			var t = this.hsl()
			return (t.color[2] -= t.color[2] * e), t
		},
		saturate: function (e) {
			var t = this.hsl()
			return (t.color[1] += t.color[1] * e), t
		},
		desaturate: function (e) {
			var t = this.hsl()
			return (t.color[1] -= t.color[1] * e), t
		},
		whiten: function (e) {
			var t = this.hwb()
			return (t.color[1] += t.color[1] * e), t
		},
		blacken: function (e) {
			var t = this.hwb()
			return (t.color[2] += t.color[2] * e), t
		},
		grayscale: function () {
			var e = this.rgb().color,
				t = e[0] * 0.3 + e[1] * 0.59 + e[2] * 0.11
			return _s.rgb(t, t, t)
		},
		fade: function (e) {
			return this.alpha(this.valpha - this.valpha * e)
		},
		opaquer: function (e) {
			return this.alpha(this.valpha + this.valpha * e)
		},
		rotate: function (e) {
			var t = this.hsl(),
				r = t.color[0]
			return (r = (r + e) % 360), (r = r < 0 ? 360 + r : r), (t.color[0] = r), t
		},
		mix: function (e, t) {
			if (!e || !e.rgb)
				throw new Error('Argument to "mix" was not a Color instance, but rather an instance of ' + typeof e)
			var r = e.rgb(),
				n = this.rgb(),
				i = t === void 0 ? 0.5 : t,
				s = 2 * i - 1,
				o = r.alpha() - n.alpha(),
				a = ((s * o === -1 ? s : (s + o) / (1 + s * o)) + 1) / 2,
				l = 1 - a
			return _s.rgb(
				a * r.red() + l * n.red(),
				a * r.green() + l * n.green(),
				a * r.blue() + l * n.blue(),
				r.alpha() * i + n.alpha() * (1 - i),
			)
		},
	}
	Object.keys(wa).forEach(function (e) {
		if (Bpe.indexOf(e) === -1) {
			var t = wa[e].channels
			;(_s.prototype[e] = function () {
				if (this.model === e) return new _s(this)
				if (arguments.length) return new _s(arguments, e)
				var r = typeof arguments[t] == "number" ? t : this.valpha
				return new _s(olt(wa[this.model][e].raw(this.color)).concat(r), e)
			}),
				(_s[e] = function (r) {
					return typeof r == "number" && (r = QH(NH.call(arguments), t)), new _s(r, e)
				})
		}
	})
	function ilt(e, t) {
		return Number(e.toFixed(t))
	}
	function slt(e) {
		return function (t) {
			return ilt(t, e)
		}
	}
	function oi(e, t, r) {
		return (
			(e = Array.isArray(e) ? e : [e]),
			e.forEach(function (n) {
				;(UR[n] || (UR[n] = []))[t] = r
			}),
			(e = e[0]),
			function (n) {
				var i
				return arguments.length
					? (r && (n = r(n)), (i = this[e]()), (i.color[t] = n), i)
					: ((i = this[e]().color[t]), r && (i = r(i)), i)
			}
		)
	}
	function qi(e) {
		return function (t) {
			return Math.max(0, Math.min(e, t))
		}
	}
	function olt(e) {
		return Array.isArray(e) ? e : [e]
	}
	function QH(e, t) {
		for (var r = 0; r < t; r++) typeof e[r] != "number" && (e[r] = 0)
		return e
	}
	Dpe.exports = _s
})