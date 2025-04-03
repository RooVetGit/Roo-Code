
var T5 = x((tBt, D5) => {
	"use strict"
	var hh = Yt()
	Sr()
	Tb()
	cl()
	;(function () {
		if (hh.prime) {
			D5.exports = hh.prime
			return
		}
		var e = (D5.exports = hh.prime = hh.prime || {}),
			t = hh.jsbn.BigInteger,
			r = [6, 4, 2, 4, 2, 4, 6, 2],
			n = new t(null)
		n.fromInt(30)
		var i = function (f, p) {
			return f | p
		}
		e.generateProbablePrime = function (f, p, g) {
			typeof p == "function" && ((g = p), (p = {})), (p = p || {})
			var m = p.algorithm || "PRIMEINC"
			typeof m == "string" && (m = { name: m }), (m.options = m.options || {})
			var y = p.prng || hh.random,
				C = {
					nextBytes: function (v) {
						for (var b = y.getBytesSync(v.length), w = 0; w < v.length; ++w) v[w] = b.charCodeAt(w)
					},
				}
			if (m.name === "PRIMEINC") return s(f, C, m.options, g)
			throw new Error("Invalid prime generation algorithm: " + m.name)
		}
		function s(f, p, g, m) {
			return "workers" in g ? l(f, p, g, m) : o(f, p, g, m)
		}
		function o(f, p, g, m) {
			var y = c(f, p),
				C = 0,
				v = u(y.bitLength())
			"millerRabinTests" in g && (v = g.millerRabinTests)
			var b = 10
			"maxBlockTime" in g && (b = g.maxBlockTime), a(y, f, p, C, v, b, m)
		}
		function a(f, p, g, m, y, C, v) {
			var b = +new Date()
			do {
				if ((f.bitLength() > p && (f = c(p, g)), f.isProbablePrime(y))) return v(null, f)
				f.dAddOffset(r[m++ % 8], 0)
			} while (C < 0 || +new Date() - b < C)
			hh.util.setImmediate(function () {
				a(f, p, g, m, y, C, v)
			})
		}
		function l(f, p, g, m) {
			if (typeof Worker > "u") return o(f, p, g, m)
			var y = c(f, p),
				C = g.workers,
				v = g.workLoad || 100,
				b = (v * 30) / 8,
				w = g.workerScript || "forge/prime.worker.js"
			if (C === -1)
				return hh.util.estimateCores(function (M, Q) {
					M && (Q = 2), (C = Q - 1), B()
				})
			B()
			function B() {
				C = Math.max(1, C)
				for (var M = [], Q = 0; Q < C; ++Q) M[Q] = new Worker(w)
				for (var O = C, Q = 0; Q < C; ++Q) M[Q].addEventListener("message", j)
				var Y = !1
				function j(ne) {
					if (!Y) {
						--O
						var q = ne.data
						if (q.found) {
							for (var me = 0; me < M.length; ++me) M[me].terminate()
							return (Y = !0), m(null, new t(q.prime, 16))
						}
						y.bitLength() > f && (y = c(f, p))
						var Qe = y.toString(16)
						ne.target.postMessage({ hex: Qe, workLoad: v }), y.dAddOffset(b, 0)
					}
				}
			}
		}
		function c(f, p) {
			var g = new t(f, p),
				m = f - 1
			return g.testBit(m) || g.bitwiseTo(t.ONE.shiftLeft(m), i, g), g.dAddOffset(31 - g.mod(n).byteValue(), 0), g
		}
		function u(f) {
			return f <= 100
				? 27
				: f <= 150
					? 18
					: f <= 200
						? 15
						: f <= 250
							? 12
							: f <= 300
								? 9
								: f <= 350
									? 8
									: f <= 400
										? 7
										: f <= 500
											? 6
											: f <= 600
												? 5
												: f <= 800
													? 4
													: f <= 1250
														? 3
														: 2
		}
	})()
})