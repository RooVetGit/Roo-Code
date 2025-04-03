
var qte = x((dIt, Ote) => {
	"use strict"
	var { isUSVString: Nte, bufferToLowerCasedHeaderName: y4e } = Xt(),
		{ utf8DecodeBytes: C4e } = ga(),
		{ HTTP_TOKEN_CODEPOINTS: v4e, isomorphicDecode: Pte } = No(),
		{ isFileLike: E4e } = OO(),
		{ makeEntry: b4e } = ME(),
		BB = require("assert"),
		{ File: x4e } = require("buffer"),
		_4e = globalThis.File ?? x4e,
		w4e = Buffer.from('form-data; name="'),
		Lte = Buffer.from("; filename"),
		I4e = Buffer.from("--"),
		S4e = Buffer.from(`--\r
`)
	function B4e(e) {
		for (let t = 0; t < e.length; ++t) if (e.charCodeAt(t) & -128) return !1
		return !0
	}
	function D4e(e) {
		let t = e.length
		if (t < 27 || t > 70) return !1
		for (let r = 0; r < t; ++r) {
			let n = e.charCodeAt(r)
			if (
				!(
					(n >= 48 && n <= 57) ||
					(n >= 65 && n <= 90) ||
					(n >= 97 && n <= 122) ||
					n === 39 ||
					n === 45 ||
					n === 95
				)
			)
				return !1
		}
		return !0
	}
	function T4e(e, t) {
		BB(t !== "failure" && t.essence === "multipart/form-data")
		let r = t.parameters.get("boundary")
		if (r === void 0) return "failure"
		let n = Buffer.from(`--${r}`, "utf8"),
			i = [],
			s = { position: 0 }
		for (; e[s.position] === 13 && e[s.position + 1] === 10; ) s.position += 2
		let o = e.length
		for (; e[o - 1] === 10 && e[o - 2] === 13; ) o -= 2
		for (o !== e.length && (e = e.subarray(0, o)); ; ) {
			if (e.subarray(s.position, s.position + n.length).equals(n)) s.position += n.length
			else return "failure"
			if ((s.position === e.length - 2 && DB(e, I4e, s)) || (s.position === e.length - 4 && DB(e, S4e, s)))
				return i
			if (e[s.position] !== 13 || e[s.position + 1] !== 10) return "failure"
			s.position += 2
			let a = R4e(e, s)
			if (a === "failure") return "failure"
			let { name: l, filename: c, contentType: u, encoding: f } = a
			s.position += 2
			let p
			{
				let m = e.indexOf(n.subarray(2), s.position)
				if (m === -1) return "failure"
				;(p = e.subarray(s.position, m - 4)),
					(s.position += p.length),
					f === "base64" && (p = Buffer.from(p.toString(), "base64"))
			}
			if (e[s.position] !== 13 || e[s.position + 1] !== 10) return "failure"
			s.position += 2
			let g
			c !== null
				? ((u ??= "text/plain"), B4e(u) || (u = ""), (g = new _4e([p], c, { type: u })))
				: (g = C4e(Buffer.from(p))),
				BB(Nte(l)),
				BB((typeof g == "string" && Nte(g)) || E4e(g)),
				i.push(b4e(l, g, c))
		}
	}
	function R4e(e, t) {
		let r = null,
			n = null,
			i = null,
			s = null
		for (;;) {
			if (e[t.position] === 13 && e[t.position + 1] === 10)
				return r === null ? "failure" : { name: r, filename: n, contentType: i, encoding: s }
			let o = r0((a) => a !== 10 && a !== 13 && a !== 58, e, t)
			if (((o = VO(o, !0, !0, (a) => a === 9 || a === 32)), !v4e.test(o.toString()) || e[t.position] !== 58))
				return "failure"
			switch ((t.position++, r0((a) => a === 32 || a === 9, e, t), y4e(o))) {
				case "content-disposition": {
					if (((r = n = null), !DB(e, w4e, t) || ((t.position += 17), (r = Ute(e, t)), r === null)))
						return "failure"
					if (DB(e, Lte, t)) {
						let a = t.position + Lte.length
						if (
							(e[a] === 42 && ((t.position += 1), (a += 1)),
							e[a] !== 61 || e[a + 1] !== 34 || ((t.position += 12), (n = Ute(e, t)), n === null))
						)
							return "failure"
					}
					break
				}
				case "content-type": {
					let a = r0((l) => l !== 10 && l !== 13, e, t)
					;(a = VO(a, !1, !0, (l) => l === 9 || l === 32)), (i = Pte(a))
					break
				}
				case "content-transfer-encoding": {
					let a = r0((l) => l !== 10 && l !== 13, e, t)
					;(a = VO(a, !1, !0, (l) => l === 9 || l === 32)), (s = Pte(a))
					break
				}
				default:
					r0((a) => a !== 10 && a !== 13, e, t)
			}
			if (e[t.position] !== 13 && e[t.position + 1] !== 10) return "failure"
			t.position += 2
		}
	}
	function Ute(e, t) {
		BB(e[t.position - 1] === 34)
		let r = r0((n) => n !== 10 && n !== 13 && n !== 34, e, t)
		return e[t.position] !== 34
			? null
			: (t.position++,
				(r = new TextDecoder()
					.decode(r)
					.replace(
						/%0A/gi,
						`
`,
					)
					.replace(/%0D/gi, "\r")
					.replace(/%22/g, '"')),
				r)
	}
	function r0(e, t, r) {
		let n = r.position
		for (; n < t.length && e(t[n]); ) ++n
		return t.subarray(r.position, (r.position = n))
	}
	function VO(e, t, r, n) {
		let i = 0,
			s = e.length - 1
		if (t) for (; i < e.length && n(e[i]); ) i++
		if (r) for (; s > 0 && n(e[s]); ) s--
		return i === 0 && s === e.length - 1 ? e : e.subarray(i, s + 1)
	}
	function DB(e, t, r) {
		if (e.length < t.length) return !1
		for (let n = 0; n < t.length; n++) if (t[n] !== e[r.position + n]) return !1
		return !0
	}
	Ote.exports = { multipartFormDataParser: T4e, validateBoundary: D4e }
})