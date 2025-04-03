
	var { createInflateRaw: nze, Z_DEFAULT_WINDOWBITS: ize } = require("zlib"),
		{ isValidClientWindowBits: sze } = Ab(),
		oze = Buffer.from([0, 0, 255, 255]),
		YD = Symbol("kBuffer"),
		KD = Symbol("kLength"),
		ZV = class {
			#e
			#t = {}
			constructor(t) {
				;(this.#t.serverNoContextTakeover = t.has("server_no_context_takeover")),
					(this.#t.serverMaxWindowBits = t.get("server_max_window_bits"))
			}
			decompress(t, r, n) {
				if (!this.#e) {
					let i = ize
					if (this.#t.serverMaxWindowBits) {
						if (!sze(this.#t.serverMaxWindowBits)) {
							n(new Error("Invalid server_max_window_bits"))
							return
						}
						i = Number.parseInt(this.#t.serverMaxWindowBits)
					}
					;(this.#e = nze({ windowBits: i })),
						(this.#e[YD] = []),
						(this.#e[KD] = 0),
						this.#e.on("data", (s) => {
							this.#e[YD].push(s), (this.#e[KD] += s.length)
						}),
						this.#e.on("error", (s) => {
							;(this.#e = null), n(s)
						})
				}
				this.#e.write(t),
					r && this.#e.write(oze),
					this.#e.flush(() => {
						let i = Buffer.concat(this.#e[YD], this.#e[KD])
						;(this.#e[YD].length = 0), (this.#e[KD] = 0), n(null, i)
					})
			}
		}