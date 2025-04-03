
	function M3(e) {
		e = { ...e }
		let t = Vnt(e)
		t && (e.bigint === void 0 && (e.bigint = !1), "circularValue" in e || (e.circularValue = Error))
		let r = Ont(e),
			n = Mfe(e, "bigint"),
			i = Mfe(e, "deterministic"),
			s = Ffe(e, "maximumDepth"),
			o = Ffe(e, "maximumBreadth")
		function a(p, g, m, y, C, v) {
			let b = g[p]
			switch (
				(typeof b == "object" && b !== null && typeof b.toJSON == "function" && (b = b.toJSON(p)),
				(b = y.call(g, p, b)),
				typeof b)
			) {
				case "string":
					return xh(b)
				case "object": {
					if (b === null) return "null"
					if (m.indexOf(b) !== -1) return r
					let w = "",
						B = ",",
						M = v
					if (Array.isArray(b)) {
						if (b.length === 0) return "[]"
						if (s < m.length + 1) return '"[Array]"'
						m.push(b),
							C !== "" &&
								((v += C),
								(w += `
${v}`),
								(B = `,
${v}`))
						let q = Math.min(b.length, o),
							me = 0
						for (; me < q - 1; me++) {
							let N = a(String(me), b, m, y, C, v)
							;(w += N !== void 0 ? N : "null"), (w += B)
						}
						let Qe = a(String(me), b, m, y, C, v)
						if (((w += Qe !== void 0 ? Qe : "null"), b.length - 1 > o)) {
							let N = b.length - o - 1
							w += `${B}"... ${Fp(N)} not stringified"`
						}
						return (
							C !== "" &&
								(w += `
${M}`),
							m.pop(),
							`[${w}]`
						)
					}
					let Q = Object.keys(b),
						O = Q.length
					if (O === 0) return "{}"
					if (s < m.length + 1) return '"[Object]"'
					let Y = "",
						j = ""
					C !== "" &&
						((v += C),
						(B = `,
${v}`),
						(Y = " "))
					let ne = Math.min(O, o)
					i && !k3(b) && (Q = R3(Q)), m.push(b)
					for (let q = 0; q < ne; q++) {
						let me = Q[q],
							Qe = a(me, b, m, y, C, v)
						Qe !== void 0 && ((w += `${j}${xh(me)}:${Y}${Qe}`), (j = B))
					}
					if (O > o) {
						let q = O - o
						;(w += `${j}"...":${Y}"${Fp(q)} not stringified"`), (j = B)
					}
					return (
						C !== "" &&
							j.length > 1 &&
							(w = `
${v}${w}
${M}`),
						m.pop(),
						`{${w}}`
					)
				}
				case "number":
					return isFinite(b) ? String(b) : t ? t(b) : "null"
				case "boolean":
					return b === !0 ? "true" : "false"
				case "undefined":
					return
				case "bigint":
					if (n) return String(b)
				default:
					return t ? t(b) : void 0
			}
		}
		function l(p, g, m, y, C, v) {
			switch (
				(typeof g == "object" && g !== null && typeof g.toJSON == "function" && (g = g.toJSON(p)), typeof g)
			) {
				case "string":
					return xh(g)
				case "object": {
					if (g === null) return "null"
					if (m.indexOf(g) !== -1) return r
					let b = v,
						w = "",
						B = ","
					if (Array.isArray(g)) {
						if (g.length === 0) return "[]"
						if (s < m.length + 1) return '"[Array]"'
						m.push(g),
							C !== "" &&
								((v += C),
								(w += `
${v}`),
								(B = `,
${v}`))
						let O = Math.min(g.length, o),
							Y = 0
						for (; Y < O - 1; Y++) {
							let ne = l(String(Y), g[Y], m, y, C, v)
							;(w += ne !== void 0 ? ne : "null"), (w += B)
						}
						let j = l(String(Y), g[Y], m, y, C, v)
						if (((w += j !== void 0 ? j : "null"), g.length - 1 > o)) {
							let ne = g.length - o - 1
							w += `${B}"... ${Fp(ne)} not stringified"`
						}
						return (
							C !== "" &&
								(w += `
${b}`),
							m.pop(),
							`[${w}]`
						)
					}
					m.push(g)
					let M = ""
					C !== "" &&
						((v += C),
						(B = `,
${v}`),
						(M = " "))
					let Q = ""
					for (let O of y) {
						let Y = l(O, g[O], m, y, C, v)
						Y !== void 0 && ((w += `${Q}${xh(O)}:${M}${Y}`), (Q = B))
					}
					return (
						C !== "" &&
							Q.length > 1 &&
							(w = `
${v}${w}
${b}`),
						m.pop(),
						`{${w}}`
					)
				}
				case "number":
					return isFinite(g) ? String(g) : t ? t(g) : "null"
				case "boolean":
					return g === !0 ? "true" : "false"
				case "undefined":
					return
				case "bigint":
					if (n) return String(g)
				default:
					return t ? t(g) : void 0
			}
		}
		function c(p, g, m, y, C) {
			switch (typeof g) {
				case "string":
					return xh(g)
				case "object": {
					if (g === null) return "null"
					if (typeof g.toJSON == "function") {
						if (((g = g.toJSON(p)), typeof g != "object")) return c(p, g, m, y, C)
						if (g === null) return "null"
					}
					if (m.indexOf(g) !== -1) return r
					let v = C
					if (Array.isArray(g)) {
						if (g.length === 0) return "[]"
						if (s < m.length + 1) return '"[Array]"'
						m.push(g), (C += y)
						let Y = `
${C}`,
							j = `,
${C}`,
							ne = Math.min(g.length, o),
							q = 0
						for (; q < ne - 1; q++) {
							let Qe = c(String(q), g[q], m, y, C)
							;(Y += Qe !== void 0 ? Qe : "null"), (Y += j)
						}
						let me = c(String(q), g[q], m, y, C)
						if (((Y += me !== void 0 ? me : "null"), g.length - 1 > o)) {
							let Qe = g.length - o - 1
							Y += `${j}"... ${Fp(Qe)} not stringified"`
						}
						return (
							(Y += `
${v}`),
							m.pop(),
							`[${Y}]`
						)
					}
					let b = Object.keys(g),
						w = b.length
					if (w === 0) return "{}"
					if (s < m.length + 1) return '"[Object]"'
					C += y
					let B = `,
${C}`,
						M = "",
						Q = "",
						O = Math.min(w, o)
					k3(g) && ((M += kfe(g, B, o)), (b = b.slice(g.length)), (O -= g.length), (Q = B)),
						i && (b = R3(b)),
						m.push(g)
					for (let Y = 0; Y < O; Y++) {
						let j = b[Y],
							ne = c(j, g[j], m, y, C)
						ne !== void 0 && ((M += `${Q}${xh(j)}: ${ne}`), (Q = B))
					}
					if (w > o) {
						let Y = w - o
						;(M += `${Q}"...": "${Fp(Y)} not stringified"`), (Q = B)
					}
					return (
						Q !== "" &&
							(M = `
${C}${M}
${v}`),
						m.pop(),
						`{${M}}`
					)
				}
				case "number":
					return isFinite(g) ? String(g) : t ? t(g) : "null"
				case "boolean":
					return g === !0 ? "true" : "false"
				case "undefined":
					return
				case "bigint":
					if (n) return String(g)
				default:
					return t ? t(g) : void 0
			}
		}
		function u(p, g, m) {
			switch (typeof g) {
				case "string":
					return xh(g)
				case "object": {
					if (g === null) return "null"
					if (typeof g.toJSON == "function") {
						if (((g = g.toJSON(p)), typeof g != "object")) return u(p, g, m)
						if (g === null) return "null"
					}
					if (m.indexOf(g) !== -1) return r
					let y = ""
					if (Array.isArray(g)) {
						if (g.length === 0) return "[]"
						if (s < m.length + 1) return '"[Array]"'
						m.push(g)
						let B = Math.min(g.length, o),
							M = 0
						for (; M < B - 1; M++) {
							let O = u(String(M), g[M], m)
							;(y += O !== void 0 ? O : "null"), (y += ",")
						}
						let Q = u(String(M), g[M], m)
						if (((y += Q !== void 0 ? Q : "null"), g.length - 1 > o)) {
							let O = g.length - o - 1
							y += `,"... ${Fp(O)} not stringified"`
						}
						return m.pop(), `[${y}]`
					}
					let C = Object.keys(g),
						v = C.length
					if (v === 0) return "{}"
					if (s < m.length + 1) return '"[Object]"'
					let b = "",
						w = Math.min(v, o)
					k3(g) && ((y += kfe(g, ",", o)), (C = C.slice(g.length)), (w -= g.length), (b = ",")),
						i && (C = R3(C)),
						m.push(g)
					for (let B = 0; B < w; B++) {
						let M = C[B],
							Q = u(M, g[M], m)
						Q !== void 0 && ((y += `${b}${xh(M)}:${Q}`), (b = ","))
					}
					if (v > o) {
						let B = v - o
						y += `${b}"...":"${Fp(B)} not stringified"`
					}
					return m.pop(), `{${y}}`
				}
				case "number":
					return isFinite(g) ? String(g) : t ? t(g) : "null"
				case "boolean":
					return g === !0 ? "true" : "false"
				case "undefined":
					return
				case "bigint":
					if (n) return String(g)
				default:
					return t ? t(g) : void 0
			}
		}
		function f(p, g, m) {
			if (arguments.length > 1) {
				let y = ""
				if (
					(typeof m == "number"
						? (y = " ".repeat(Math.min(m, 10)))
						: typeof m == "string" && (y = m.slice(0, 10)),
					g != null)
				) {
					if (typeof g == "function") return a("", { "": p }, [], g, y, "")
					if (Array.isArray(g)) return l("", p, [], qnt(g), y, "")
				}
				if (y.length !== 0) return c("", p, [], y, "")
			}
			return u("", p, [])
		}
		return f
	}