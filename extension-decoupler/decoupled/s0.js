
var s0 = x((fIt, Jte) => {
	"use strict"
	var FE = Xt(),
		{
			ReadableStreamFrom: k4e,
			isBlobLike: Vte,
			isReadableStreamLike: M4e,
			readableStreamClose: F4e,
			createDeferredPromise: Q4e,
			fullyReadBody: N4e,
			extractMimeType: P4e,
			utf8DecodeBytes: Gte,
		} = ga(),
		{ FormData: Hte } = ME(),
		{ kState: i0 } = Gf(),
		{ webidl: L4e } = ys(),
		{ Blob: U4e } = require("buffer"),
		HO = require("assert"),
		{ isErrored: $te, isDisturbed: O4e } = require("stream"),
		{ isArrayBuffer: q4e } = require("util/types"),
		{ serializeAMimeType: V4e } = No(),
		{ multipartFormDataParser: H4e } = qte(),
		WO
	try {
		let e = require("crypto")
		WO = (t) => e.randomInt(0, t)
	} catch {
		WO = (e) => Math.floor(Math.random(e))
	}
	var TB = new TextEncoder()
	function W4e() {}
	var GO = globalThis.FinalizationRegistry && process.version.indexOf("v18") !== 0,
		$O
	GO &&
		($O = new FinalizationRegistry((e) => {
			let t = e.deref()
			t && !t.locked && !O4e(t) && !$te(t) && t.cancel("Response object has been garbage collected").catch(W4e)
		}))
	function Yte(e, t = !1) {
		let r = null
		e instanceof ReadableStream
			? (r = e)
			: Vte(e)
				? (r = e.stream())
				: (r = new ReadableStream({
						async pull(l) {
							let c = typeof i == "string" ? TB.encode(i) : i
							c.byteLength && l.enqueue(c), queueMicrotask(() => F4e(l))
						},
						start() {},
						type: "bytes",
					})),
			HO(M4e(r))
		let n = null,
			i = null,
			s = null,
			o = null
		if (typeof e == "string") (i = e), (o = "text/plain;charset=UTF-8")
		else if (e instanceof URLSearchParams)
			(i = e.toString()), (o = "application/x-www-form-urlencoded;charset=UTF-8")
		else if (q4e(e)) i = new Uint8Array(e.slice())
		else if (ArrayBuffer.isView(e)) i = new Uint8Array(e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength))
		else if (FE.isFormDataLike(e)) {
			let l = `----formdata-undici-0${`${WO(1e11)}`.padStart(11, "0")}`,
				c = `--${l}\r
Content-Disposition: form-data`
			let u = (C) => C.replace(/\n/g, "%0A").replace(/\r/g, "%0D").replace(/"/g, "%22"),
				f = (C) =>
					C.replace(
						/\r?\n|\r/g,
						`\r
`,
					),
				p = [],
				g = new Uint8Array([13, 10])
			s = 0
			let m = !1
			for (let [C, v] of e)
				if (typeof v == "string") {
					let b = TB.encode(
						c +
							`; name="${u(f(C))}"\r
\r
${f(v)}\r
`,
					)
					p.push(b), (s += b.byteLength)
				} else {
					let b = TB.encode(
						`${c}; name="${u(f(C))}"` +
							(v.name ? `; filename="${u(v.name)}"` : "") +
							`\r
Content-Type: ${v.type || "application/octet-stream"}\r
\r
`,
					)
					p.push(b, v, g), typeof v.size == "number" ? (s += b.byteLength + v.size + g.byteLength) : (m = !0)
				}
			let y = TB.encode(`--${l}--`)
			p.push(y),
				(s += y.byteLength),
				m && (s = null),
				(i = e),
				(n = async function* () {
					for (let C of p) C.stream ? yield* C.stream() : yield C
				}),
				(o = `multipart/form-data; boundary=${l}`)
		} else if (Vte(e)) (i = e), (s = e.size), e.type && (o = e.type)
		else if (typeof e[Symbol.asyncIterator] == "function") {
			if (t) throw new TypeError("keepalive")
			if (FE.isDisturbed(e) || e.locked)
				throw new TypeError("Response body object should not be disturbed or locked")
			r = e instanceof ReadableStream ? e : k4e(e)
		}
		if (((typeof i == "string" || FE.isBuffer(i)) && (s = Buffer.byteLength(i)), n != null)) {
			let l
			r = new ReadableStream({
				async start() {
					l = n(e)[Symbol.asyncIterator]()
				},
				async pull(c) {
					let { value: u, done: f } = await l.next()
					if (f)
						queueMicrotask(() => {
							c.close(), c.byobRequest?.respond(0)
						})
					else if (!$te(r)) {
						let p = new Uint8Array(u)
						p.byteLength && c.enqueue(p)
					}
					return c.desiredSize > 0
				},
				async cancel(c) {
					await l.return()
				},
				type: "bytes",
			})
		}
		return [{ stream: r, source: i, length: s }, o]
	}
	function G4e(e, t = !1) {
		return (
			e instanceof ReadableStream &&
				(HO(!FE.isDisturbed(e), "The body has already been consumed."), HO(!e.locked, "The stream is locked.")),
			Yte(e, t)
		)
	}
	function $4e(e, t) {
		let [r, n] = t.stream.tee()
		return GO && $O.register(e, new WeakRef(r)), (t.stream = r), { stream: n, length: t.length, source: t.source }
	}
	function Y4e(e) {
		if (e.aborted) throw new DOMException("The operation was aborted.", "AbortError")
	}
	function K4e(e) {
		return {
			blob() {
				return n0(
					this,
					(r) => {
						let n = Wte(this)
						return n === null ? (n = "") : n && (n = V4e(n)), new U4e([r], { type: n })
					},
					e,
				)
			},
			arrayBuffer() {
				return n0(this, (r) => new Uint8Array(r).buffer, e)
			},
			text() {
				return n0(this, Gte, e)
			},
			json() {
				return n0(this, z4e, e)
			},
			formData() {
				return n0(
					this,
					(r) => {
						let n = Wte(this)
						if (n !== null)
							switch (n.essence) {
								case "multipart/form-data": {
									let i = H4e(r, n)
									if (i === "failure") throw new TypeError("Failed to parse body as FormData.")
									let s = new Hte()
									return (s[i0] = i), s
								}
								case "application/x-www-form-urlencoded": {
									let i = new URLSearchParams(r.toString()),
										s = new Hte()
									for (let [o, a] of i) s.append(o, a)
									return s
								}
							}
						throw new TypeError(
							'Content-Type was not one of "multipart/form-data" or "application/x-www-form-urlencoded".',
						)
					},
					e,
				)
			},
			bytes() {
				return n0(this, (r) => new Uint8Array(r), e)
			},
		}
	}
	function J4e(e) {
		Object.assign(e.prototype, K4e(e))
	}
	async function n0(e, t, r) {
		if ((L4e.brandCheck(e, r), Kte(e))) throw new TypeError("Body is unusable: Body has already been read")
		Y4e(e[i0])
		let n = Q4e(),
			i = (o) => n.reject(o),
			s = (o) => {
				try {
					n.resolve(t(o))
				} catch (a) {
					i(a)
				}
			}
		return e[i0].body == null ? (s(Buffer.allocUnsafe(0)), n.promise) : (await N4e(e[i0].body, s, i), n.promise)
	}
	function Kte(e) {
		let t = e[i0].body
		return t != null && (t.stream.locked || FE.isDisturbed(t.stream))
	}
	function z4e(e) {
		return JSON.parse(Gte(e))
	}
	function Wte(e) {
		let t = e[i0].headersList,
			r = P4e(t)
		return r === "failure" ? null : r
	}
	Jte.exports = {
		extractBody: Yte,
		safelyExtractBody: G4e,
		cloneBody: $4e,
		mixinBody: J4e,
		streamRegistry: $O,
		hasFinalizationRegistry: GO,
		bodyUnusable: Kte,
	}
})