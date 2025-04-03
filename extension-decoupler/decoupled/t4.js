
var T4 = x((e2t, _Ce) => {
	"use strict"
	function Ugt(e) {
		;(r.debug = r),
			(r.default = r),
			(r.coerce = l),
			(r.disable = s),
			(r.enable = i),
			(r.enabled = o),
			(r.humanize = jT()),
			(r.destroy = c),
			Object.keys(e).forEach((u) => {
				r[u] = e[u]
			}),
			(r.names = []),
			(r.skips = []),
			(r.formatters = {})
		function t(u) {
			let f = 0
			for (let p = 0; p < u.length; p++) (f = (f << 5) - f + u.charCodeAt(p)), (f |= 0)
			return r.colors[Math.abs(f) % r.colors.length]
		}
		r.selectColor = t
		function r(u) {
			let f,
				p = null,
				g,
				m
			function y(...C) {
				if (!y.enabled) return
				let v = y,
					b = Number(new Date()),
					w = b - (f || b)
				;(v.diff = w),
					(v.prev = f),
					(v.curr = b),
					(f = b),
					(C[0] = r.coerce(C[0])),
					typeof C[0] != "string" && C.unshift("%O")
				let B = 0
				;(C[0] = C[0].replace(/%([a-zA-Z%])/g, (Q, O) => {
					if (Q === "%%") return "%"
					B++
					let Y = r.formatters[O]
					if (typeof Y == "function") {
						let j = C[B]
						;(Q = Y.call(v, j)), C.splice(B, 1), B--
					}
					return Q
				})),
					r.formatArgs.call(v, C),
					(v.log || r.log).apply(v, C)
			}
			return (
				(y.namespace = u),
				(y.useColors = r.useColors()),
				(y.color = r.selectColor(u)),
				(y.extend = n),
				(y.destroy = r.destroy),
				Object.defineProperty(y, "enabled", {
					enumerable: !0,
					configurable: !1,
					get: () => (p !== null ? p : (g !== r.namespaces && ((g = r.namespaces), (m = r.enabled(u))), m)),
					set: (C) => {
						p = C
					},
				}),
				typeof r.init == "function" && r.init(y),
				y
			)
		}
		function n(u, f) {
			let p = r(this.namespace + (typeof f > "u" ? ":" : f) + u)
			return (p.log = this.log), p
		}
		function i(u) {
			r.save(u), (r.namespaces = u), (r.names = []), (r.skips = [])
			let f,
				p = (typeof u == "string" ? u : "").split(/[\s,]+/),
				g = p.length
			for (f = 0; f < g; f++)
				p[f] &&
					((u = p[f].replace(/\*/g, ".*?")),
					u[0] === "-"
						? r.skips.push(new RegExp("^" + u.slice(1) + "$"))
						: r.names.push(new RegExp("^" + u + "$")))
		}
		function s() {
			let u = [...r.names.map(a), ...r.skips.map(a).map((f) => "-" + f)].join(",")
			return r.enable(""), u
		}
		function o(u) {
			if (u[u.length - 1] === "*") return !0
			let f, p
			for (f = 0, p = r.skips.length; f < p; f++) if (r.skips[f].test(u)) return !1
			for (f = 0, p = r.names.length; f < p; f++) if (r.names[f].test(u)) return !0
			return !1
		}
		function a(u) {
			return u
				.toString()
				.substring(2, u.toString().length - 2)
				.replace(/\.\*\?$/, "*")
		}
		function l(u) {
			return u instanceof Error ? u.stack || u.message : u
		}
		function c() {
			console.warn(
				"Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.",
			)
		}
		return r.enable(r.load()), r
	}
	_Ce.exports = Ugt
})