
var Zpe = x(($Tt, jpe) => {
	"use strict"
	var LH = require("fs"),
		{ StringDecoder: hlt } = require("string_decoder"),
		{ Stream: glt } = dy()
	function plt() {}
	jpe.exports = (e, t) => {
		let r = Buffer.alloc(65536),
			n = new hlt("utf8"),
			i = new glt(),
			s = "",
			o = 0,
			a = 0
		return (
			e.start === -1 && delete e.start,
			(i.readable = !0),
			(i.destroy = () => {
				;(i.destroyed = !0), i.emit("end"), i.emit("close")
			}),
			LH.open(e.file, "a+", "0644", (l, c) => {
				if (l) {
					t ? t(l) : i.emit("error", l), i.destroy()
					return
				}
				;(function u() {
					if (i.destroyed) {
						LH.close(c, plt)
						return
					}
					return LH.read(c, r, 0, r.length, o, (f, p) => {
						if (f) {
							t ? t(f) : i.emit("error", f), i.destroy()
							return
						}
						if (!p)
							return (
								s &&
									((e.start == null || a > e.start) && (t ? t(null, s) : i.emit("line", s)),
									a++,
									(s = "")),
								setTimeout(u, 1e3)
							)
						let g = n.write(r.slice(0, p))
						t || i.emit("data", g), (g = (s + g).split(/\n+/))
						let m = g.length - 1,
							y = 0
						for (; y < m; y++)
							(e.start == null || a > e.start) && (t ? t(null, g[y]) : i.emit("line", g[y])), a++
						return (s = g[m]), (o += p), u()
					})
				})()
			}),
			t ? i.destroy : i
		)
	}
})