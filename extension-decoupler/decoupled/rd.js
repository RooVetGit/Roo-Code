
	var r9e = require("assert"),
		{ Readable: n9e } = Uq(),
		{ InvalidArgumentError: p0, RequestAbortedError: Qne } = Vr(),
		Aa = Xt(),
		{ getResolveErrorBodyCallback: i9e } = Oq(),
		{ AsyncResource: s9e } = require("async_hooks"),
		rD = class extends s9e {
			constructor(t, r) {
				if (!t || typeof t != "object") throw new p0("invalid opts")
				let {
					signal: n,
					method: i,
					opaque: s,
					body: o,
					onInfo: a,
					responseHeaders: l,
					throwOnError: c,
					highWaterMark: u,
				} = t
				try {
					if (typeof r != "function") throw new p0("invalid callback")
					if (u && (typeof u != "number" || u < 0)) throw new p0("invalid highWaterMark")
					if (n && typeof n.on != "function" && typeof n.addEventListener != "function")
						throw new p0("signal must be an EventEmitter or EventTarget")
					if (i === "CONNECT") throw new p0("invalid method")
					if (a && typeof a != "function") throw new p0("invalid onInfo callback")
					super("UNDICI_REQUEST")
				} catch (f) {
					throw (Aa.isStream(o) && Aa.destroy(o.on("error", Aa.nop), f), f)
				}
				;(this.method = i),
					(this.responseHeaders = l || null),
					(this.opaque = s || null),
					(this.callback = r),
					(this.res = null),
					(this.abort = null),
					(this.body = o),
					(this.trailers = {}),
					(this.context = null),
					(this.onInfo = a || null),
					(this.throwOnError = c),
					(this.highWaterMark = u),
					(this.signal = n),
					(this.reason = null),
					(this.removeAbortListener = null),
					Aa.isStream(o) &&
						o.on("error", (f) => {
							this.onError(f)
						}),
					this.signal &&
						(this.signal.aborted
							? (this.reason = this.signal.reason ?? new Qne())
							: (this.removeAbortListener = Aa.addAbortListener(this.signal, () => {
									;(this.reason = this.signal.reason ?? new Qne()),
										this.res
											? Aa.destroy(this.res.on("error", Aa.nop), this.reason)
											: this.abort && this.abort(this.reason),
										this.removeAbortListener &&
											(this.res?.off("close", this.removeAbortListener),
											this.removeAbortListener(),
											(this.removeAbortListener = null))
								})))
			}
			onConnect(t, r) {
				if (this.reason) {
					t(this.reason)
					return
				}
				r9e(this.callback), (this.abort = t), (this.context = r)
			}
			onHeaders(t, r, n, i) {
				let { callback: s, opaque: o, abort: a, context: l, responseHeaders: c, highWaterMark: u } = this,
					f = c === "raw" ? Aa.parseRawHeaders(r) : Aa.parseHeaders(r)
				if (t < 200) {
					this.onInfo && this.onInfo({ statusCode: t, headers: f })
					return
				}
				let p = c === "raw" ? Aa.parseHeaders(r) : f,
					g = p["content-type"],
					m = p["content-length"],
					y = new n9e({
						resume: n,
						abort: a,
						contentType: g,
						contentLength: this.method !== "HEAD" && m ? Number(m) : null,
						highWaterMark: u,
					})
				this.removeAbortListener && y.on("close", this.removeAbortListener),
					(this.callback = null),
					(this.res = y),
					s !== null &&
						(this.throwOnError && t >= 400
							? this.runInAsyncScope(i9e, null, {
									callback: s,
									body: y,
									contentType: g,
									statusCode: t,
									statusMessage: i,
									headers: f,
								})
							: this.runInAsyncScope(s, null, null, {
									statusCode: t,
									headers: f,
									trailers: this.trailers,
									opaque: o,
									body: y,
									context: l,
								}))
			}
			onData(t) {
				return this.res.push(t)
			}
			onComplete(t) {
				Aa.parseHeaders(t, this.trailers), this.res.push(null)
			}
			onError(t) {
				let { res: r, callback: n, body: i, opaque: s } = this
				n &&
					((this.callback = null),
					queueMicrotask(() => {
						this.runInAsyncScope(n, null, t, { opaque: s })
					})),
					r &&
						((this.res = null),
						queueMicrotask(() => {
							Aa.destroy(r, t)
						})),
					i && ((this.body = null), Aa.destroy(i, t)),
					this.removeAbortListener &&
						(r?.off("close", this.removeAbortListener),
						this.removeAbortListener(),
						(this.removeAbortListener = null))
			}
		}