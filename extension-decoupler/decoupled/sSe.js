
	function sse(e, t) {
		if (Array.isArray(t))
			for (let r = 0; r < t.length; ++r) {
				let n = t[r]
				if (n.length !== 2)
					throw Er.errors.exception({
						header: "Headers constructor",
						message: `expected name/value pair to be length 2, found ${n.length}.`,
					})
				bV(e, n[0], n[1])
			}
		else if (typeof t == "object" && t !== null) {
			let r = Object.keys(t)
			for (let n = 0; n < r.length; ++n) bV(e, r[n], t[r[n]])
		} else
			throw Er.errors.conversionFailed({
				prefix: "Headers constructor",
				argument: "Argument 1",
				types: ["sequence<sequence<ByteString>>", "record<ByteString, ByteString>"],
			})
	}