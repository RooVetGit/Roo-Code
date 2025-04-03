
	async function t9e({ callback: e, body: t, contentType: r, statusCode: n, statusMessage: i, headers: s }) {
		X6e(t)
		let o = [],
			a = 0
		try {
			for await (let f of t)
				if ((o.push(f), (a += f.length), a > e9e)) {
					;(o = []), (a = 0)
					break
				}
		} catch {
			;(o = []), (a = 0)
		}
		let l = `Response status code ${n}${i ? `: ${i}` : ""}`
		if (n === 204 || !r || !a) {
			queueMicrotask(() => e(new Tne(l, n, s)))
			return
		}
		let c = Error.stackTraceLimit
		Error.stackTraceLimit = 0
		let u
		try {
			kne(r) ? (u = JSON.parse(Rne(o, a))) : Mne(r) && (u = Rne(o, a))
		} catch {
		} finally {
			Error.stackTraceLimit = c
		}
		queueMicrotask(() => e(new Tne(l, n, s, u)))
	}