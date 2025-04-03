
	var H6e = _E(),
		W6e = tD(),
		Mq = class extends H6e {
			#e = null
			#t = null
			constructor(t, r = {}) {
				super(r), (this.#e = t), (this.#t = r)
			}
			dispatch(t, r) {
				let n = new W6e(
					{ ...t, retryOptions: this.#t },
					{ dispatch: this.#e.dispatch.bind(this.#e), handler: r },
				)
				return this.#e.dispatch(t, n)
			}
			close() {
				return this.#e.close()
			}
			destroy() {
				return this.#e.destroy()
			}
		}