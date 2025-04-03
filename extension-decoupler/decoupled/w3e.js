
	function W3e(e) {
		let t
		return new ReadableStream({
			async start() {
				t = e[Symbol.asyncIterator]()
			},
			async pull(r) {
				let { done: n, value: i } = await t.next()
				if (n)
					queueMicrotask(() => {
						r.close(), r.byobRequest?.respond(0)
					})
				else {
					let s = Buffer.isBuffer(i) ? i : Buffer.from(i)
					s.byteLength && r.enqueue(new Uint8Array(s))
				}
				return r.desiredSize > 0
			},
			async cancel(r) {
				await t.return()
			},
			type: "bytes",
		})
	}