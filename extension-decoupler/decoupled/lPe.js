
var Lpe = x((LTt, Ppe) => {
	"use strict"
	function mc(e, t) {
		if (t) return new mc(e).style(t)
		if (!(this instanceof mc)) return new mc(e)
		this.text = e
	}
	mc.prototype.prefix = "\x1B["
	mc.prototype.suffix = "m"
	mc.prototype.hex = function (t) {
		;(t = t[0] === "#" ? t.substring(1) : t),
			t.length === 3 &&
				((t = t.split("")),
				(t[5] = t[2]),
				(t[4] = t[2]),
				(t[3] = t[1]),
				(t[2] = t[1]),
				(t[1] = t[0]),
				(t = t.join("")))
		var r = t.substring(0, 2),
			n = t.substring(2, 4),
			i = t.substring(4, 6)
		return [parseInt(r, 16), parseInt(n, 16), parseInt(i, 16)]
	}
	mc.prototype.rgb = function (t, r, n) {
		var i = (t / 255) * 5,
			s = (r / 255) * 5,
			o = (n / 255) * 5
		return this.ansi(i, s, o)
	}
	mc.prototype.ansi = function (t, r, n) {
		var i = Math.round(t),
			s = Math.round(r),
			o = Math.round(n)
		return 16 + i * 36 + s * 6 + o
	}
	mc.prototype.reset = function () {
		return this.prefix + "39;49" + this.suffix
	}
	mc.prototype.style = function (t) {
		return this.prefix + "38;5;" + this.rgb.apply(this, this.hex(t)) + this.suffix + this.text + this.reset()
	}
	Ppe.exports = mc
})