
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