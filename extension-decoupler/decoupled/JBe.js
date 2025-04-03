
var jbe = x((Cqt, zbe) => {
	"use strict"
	var UG = MG()
	zbe.exports = function (t, r, n) {
		let i = [],
			s = "",
			o,
			a,
			l = "",
			c
		if (
			(r != null && typeof r == "object" && !Array.isArray(r) && ((n = r.space), (c = r.quote), (r = r.replacer)),
			typeof r == "function")
		)
			a = r
		else if (Array.isArray(r)) {
			o = []
			for (let y of r) {
				let C
				typeof y == "string"
					? (C = y)
					: (typeof y == "number" || y instanceof String || y instanceof Number) && (C = String(y)),
					C !== void 0 && o.indexOf(C) < 0 && o.push(C)
			}
		}
		return (
			n instanceof Number ? (n = Number(n)) : n instanceof String && (n = String(n)),
			typeof n == "number"
				? n > 0 && ((n = Math.min(10, Math.floor(n))), (l = "          ".substr(0, n)))
				: typeof n == "string" && (l = n.substr(0, 10)),
			u("", { "": t })
		)
		function u(y, C) {
			let v = C[y]
			switch (
				(v != null &&
					(typeof v.toJSON5 == "function"
						? (v = v.toJSON5(y))
						: typeof v.toJSON == "function" && (v = v.toJSON(y))),
				a && (v = a.call(C, y, v)),
				v instanceof Number
					? (v = Number(v))
					: v instanceof String
						? (v = String(v))
						: v instanceof Boolean && (v = v.valueOf()),
				v)
			) {
				case null:
					return "null"
				case !0:
					return "true"
				case !1:
					return "false"
			}
			if (typeof v == "string") return f(v, !1)
			if (typeof v == "number") return String(v)
			if (typeof v == "object") return Array.isArray(v) ? m(v) : p(v)
		}
		function f(y) {
			let C = { "'": 0.1, '"': 0.2 },
				v = {
					"'": "\\'",
					'"': '\\"',
					"\\": "\\\\",
					"\b": "\\b",
					"\f": "\\f",
					"\n": "\\n",
					"\r": "\\r",
					"	": "\\t",
					"\v": "\\v",
					"\0": "\\0",
					"\u2028": "\\u2028",
					"\u2029": "\\u2029",
				},
				b = ""
			for (let B = 0; B < y.length; B++) {
				let M = y[B]
				switch (M) {
					case "'":
					case '"':
						C[M]++, (b += M)
						continue
					case "\0":
						if (UG.isDigit(y[B + 1])) {
							b += "\\x00"
							continue
						}
				}
				if (v[M]) {
					b += v[M]
					continue
				}
				if (M < " ") {
					let Q = M.charCodeAt(0).toString(16)
					b += "\\x" + ("00" + Q).substring(Q.length)
					continue
				}
				b += M
			}
			let w = c || Object.keys(C).reduce((B, M) => (C[B] < C[M] ? B : M))
			return (b = b.replace(new RegExp(w, "g"), v[w])), w + b + w
		}
		function p(y) {
			if (i.indexOf(y) >= 0) throw TypeError("Converting circular structure to JSON5")
			i.push(y)
			let C = s
			s = s + l
			let v = o || Object.keys(y),
				b = []
			for (let B of v) {
				let M = u(B, y)
				if (M !== void 0) {
					let Q = g(B) + ":"
					l !== "" && (Q += " "), (Q += M), b.push(Q)
				}
			}
			let w
			if (b.length === 0) w = "{}"
			else {
				let B
				if (l === "") (B = b.join(",")), (w = "{" + B + "}")
				else {
					let M =
						`,
` + s
					;(B = b.join(M)),
						(w =
							`{
` +
							s +
							B +
							`,
` +
							C +
							"}")
				}
			}
			return i.pop(), (s = C), w
		}
		function g(y) {
			if (y.length === 0) return f(y, !0)
			let C = String.fromCodePoint(y.codePointAt(0))
			if (!UG.isIdStartChar(C)) return f(y, !0)
			for (let v = C.length; v < y.length; v++)
				if (!UG.isIdContinueChar(String.fromCodePoint(y.codePointAt(v)))) return f(y, !0)
			return y
		}
		function m(y) {
			if (i.indexOf(y) >= 0) throw TypeError("Converting circular structure to JSON5")
			i.push(y)
			let C = s
			s = s + l
			let v = []
			for (let w = 0; w < y.length; w++) {
				let B = u(String(w), y)
				v.push(B !== void 0 ? B : "null")
			}
			let b
			if (v.length === 0) b = "[]"
			else if (l === "") b = "[" + v.join(",") + "]"
			else {
				let w =
						`,
` + s,
					B = v.join(w)
				b =
					`[
` +
					s +
					B +
					`,
` +
					C +
					"]"
			}
			return i.pop(), (s = C), b
		}
	}
})