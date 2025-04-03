
var Zde = x((CDt, jde) => {
	"use strict"
	jde.exports = function (t, r) {
		var n = ""
		;(t = t || "Run the trap, drop the bass"), (t = t.split(""))
		var i = {
			a: ["@", "\u0104", "\u023A", "\u0245", "\u0394", "\u039B", "\u0414"],
			b: ["\xDF", "\u0181", "\u0243", "\u026E", "\u03B2", "\u0E3F"],
			c: ["\xA9", "\u023B", "\u03FE"],
			d: ["\xD0", "\u018A", "\u0500", "\u0501", "\u0502", "\u0503"],
			e: ["\xCB", "\u0115", "\u018E", "\u0258", "\u03A3", "\u03BE", "\u04BC", "\u0A6C"],
			f: ["\u04FA"],
			g: ["\u0262"],
			h: ["\u0126", "\u0195", "\u04A2", "\u04BA", "\u04C7", "\u050A"],
			i: ["\u0F0F"],
			j: ["\u0134"],
			k: ["\u0138", "\u04A0", "\u04C3", "\u051E"],
			l: ["\u0139"],
			m: ["\u028D", "\u04CD", "\u04CE", "\u0520", "\u0521", "\u0D69"],
			n: ["\xD1", "\u014B", "\u019D", "\u0376", "\u03A0", "\u048A"],
			o: ["\xD8", "\xF5", "\xF8", "\u01FE", "\u0298", "\u047A", "\u05DD", "\u06DD", "\u0E4F"],
			p: ["\u01F7", "\u048E"],
			q: ["\u09CD"],
			r: ["\xAE", "\u01A6", "\u0210", "\u024C", "\u0280", "\u042F"],
			s: ["\xA7", "\u03DE", "\u03DF", "\u03E8"],
			t: ["\u0141", "\u0166", "\u0373"],
			u: ["\u01B1", "\u054D"],
			v: ["\u05D8"],
			w: ["\u0428", "\u0460", "\u047C", "\u0D70"],
			x: ["\u04B2", "\u04FE", "\u04FC", "\u04FD"],
			y: ["\xA5", "\u04B0", "\u04CB"],
			z: ["\u01B5", "\u0240"],
		}
		return (
			t.forEach(function (s) {
				s = s.toLowerCase()
				var o = i[s] || [" "],
					a = Math.floor(Math.random() * o.length)
				typeof i[s] < "u" ? (n += i[s][a]) : (n += s)
			}),
			n
		)
	}
})