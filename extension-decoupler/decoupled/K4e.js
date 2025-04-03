
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