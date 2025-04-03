
	var NO = class extends fWe {
		#e
		constructor(t) {
			super(), (this.#e = t)
		}
		_transform(t, r, n) {
			if (!this._inflateStream) {
				if (t.length === 0) {
					n()
					return
				}
				;(this._inflateStream = (t[0] & 15) === 8 ? pte.createInflate(this.#e) : pte.createInflateRaw(this.#e)),
					this._inflateStream.on("data", this.push.bind(this)),
					this._inflateStream.on("end", () => this.push(null)),
					this._inflateStream.on("error", (i) => this.destroy(i))
			}
			this._inflateStream.write(t, r, n)
		}
		_final(t) {
			this._inflateStream && (this._inflateStream.end(), (this._inflateStream = null)), t()
		}
	}