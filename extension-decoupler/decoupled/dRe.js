
	async function dre(e, t, r, n, i, s, o, a) {
		il(o !== 0 || n[VB] === 0, "iterator body cannot be pipelined")
		let l = null
		function c() {
			if (l) {
				let f = l
				;(l = null), f()
			}
		}
		let u = () =>
			new Promise((f, p) => {
				il(l === null), s[oc] ? p(s[oc]) : (l = f)
			})
		t.on("close", c).on("drain", c)
		try {
			for await (let f of r) {
				if (s[oc]) throw s[oc]
				let p = t.write(f)
				i.onBodySent(f), p || (await u())
			}
			t.end(), i.onRequestSent(), a || (s[qB] = !0), n[Jf]()
		} catch (f) {
			e(f)
		} finally {
			t.off("close", c).off("drain", c)
		}
	}