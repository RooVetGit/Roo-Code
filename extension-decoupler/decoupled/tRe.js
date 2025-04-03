
	async function tre(e, t, r, n, i, s, o, a) {
		ht(s !== 0 || r[Os] === 0, "iterator body cannot be pipelined")
		let l = null
		function c() {
			if (l) {
				let p = l
				;(l = null), p()
			}
		}
		let u = () =>
			new Promise((p, g) => {
				ht(l === null), i[nl] ? g(i[nl]) : (l = p)
			})
		i.on("close", c).on("drain", c)
		let f = new LB({
			abort: e,
			socket: i,
			request: n,
			contentLength: s,
			client: r,
			expectsPayload: a,
			header: o,
		})
		try {
			for await (let p of t) {
				if (i[nl]) throw i[nl]
				f.write(p) || (await u())
			}
			f.end()
		} catch (p) {
			f.destroy(p)
		} finally {
			i.off("close", c).off("drain", c)
		}
	}