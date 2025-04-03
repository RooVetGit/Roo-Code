
	var _$e = Xt(),
		{ InvalidArgumentError: w$e, RequestAbortedError: I$e } = Vr(),
		S$e = fD(),
		yV = class extends S$e {
			#e = 1024 * 1024
			#t = null
			#i = !1
			#n = !1
			#r = 0
			#l = null
			#o = null
			constructor({ maxSize: t }, r) {
				if ((super(r), t != null && (!Number.isFinite(t) || t < 1)))
					throw new w$e("maxSize must be a number greater than 0")
				;(this.#e = t ?? this.#e), (this.#o = r)
			}
			onConnect(t) {
				;(this.#t = t), this.#o.onConnect(this.#u.bind(this))
			}
			#u(t) {
				;(this.#n = !0), (this.#l = t)
			}
			onHeaders(t, r, n, i) {
				let o = _$e.parseHeaders(r)["content-length"]
				if (o != null && o > this.#e) throw new I$e(`Response size (${o}) larger than maxSize (${this.#e})`)
				return this.#n ? !0 : this.#o.onHeaders(t, r, n, i)
			}
			onError(t) {
				this.#i || ((t = this.#l ?? t), this.#o.onError(t))
			}
			onData(t) {
				return (
					(this.#r = this.#r + t.length),
					this.#r >= this.#e && ((this.#i = !0), this.#n ? this.#o.onError(this.#l) : this.#o.onComplete([])),
					!0
				)
			}
			onComplete(t) {
				if (!this.#i) {
					if (this.#n) {
						this.#o.onError(this.reason)
						return
					}
					this.#o.onComplete(t)
				}
			}
		}