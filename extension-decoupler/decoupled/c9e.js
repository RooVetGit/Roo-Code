
	var c9e = require("assert"),
		{ finished: u9e, PassThrough: d9e } = require("stream"),
		{ InvalidArgumentError: m0, InvalidReturnValueError: f9e } = Vr(),
		cc = Xt(),
		{ getResolveErrorBodyCallback: h9e } = Oq(),
		{ AsyncResource: g9e } = require("async_hooks"),
		{ addSignal: p9e, removeSignal: qne } = rb(),
		Vq = class extends g9e {
			constructor(t, r, n) {
				if (!t || typeof t != "object") throw new m0("invalid opts")
				let { signal: i, method: s, opaque: o, body: a, onInfo: l, responseHeaders: c, throwOnError: u } = t
				try {
					if (typeof n != "function") throw new m0("invalid callback")
					if (typeof r != "function") throw new m0("invalid factory")
					if (i && typeof i.on != "function" && typeof i.addEventListener != "function")
						throw new m0("signal must be an EventEmitter or EventTarget")
					if (s === "CONNECT") throw new m0("invalid method")
					if (l && typeof l != "function") throw new m0("invalid onInfo callback")
					super("UNDICI_STREAM")
				} catch (f) {
					throw (cc.isStream(a) && cc.destroy(a.on("error", cc.nop), f), f)
				}
				;(this.responseHeaders = c || null),
					(this.opaque = o || null),
					(this.factory = r),
					(this.callback = n),
					(this.res = null),
					(this.abort = null),
					(this.context = null),
					(this.trailers = null),
					(this.body = a),
					(this.onInfo = l || null),
					(this.throwOnError = u || !1),
					cc.isStream(a) &&
						a.on("error", (f) => {
							this.onError(f)
						}),
					p9e(this, i)
			}
			onConnect(t, r) {
				if (this.reason) {
					t(this.reason)
					return
				}
				c9e(this.callback), (this.abort = t), (this.context = r)
			}
			onHeaders(t, r, n, i) {
				let { factory: s, opaque: o, context: a, callback: l, responseHeaders: c } = this,
					u = c === "raw" ? cc.parseRawHeaders(r) : cc.parseHeaders(r)
				if (t < 200) {
					this.onInfo && this.onInfo({ statusCode: t, headers: u })
					return
				}
				this.factory = null
				let f
				if (this.throwOnError && t >= 400) {
					let m = (c === "raw" ? cc.parseHeaders(r) : u)["content-type"]
					;(f = new d9e()),
						(this.callback = null),
						this.runInAsyncScope(h9e, null, {
							callback: l,
							body: f,
							contentType: m,
							statusCode: t,
							statusMessage: i,
							headers: u,
						})
				} else {
					if (s === null) return
					if (
						((f = this.runInAsyncScope(s, null, {
							statusCode: t,
							headers: u,
							opaque: o,
							context: a,
						})),
						!f || typeof f.write != "function" || typeof f.end != "function" || typeof f.on != "function")
					)
						throw new f9e("expected Writable")
					u9e(f, { readable: !1 }, (g) => {
						let { callback: m, res: y, opaque: C, trailers: v, abort: b } = this
						;(this.res = null),
							(g || !y.readable) && cc.destroy(y, g),
							(this.callback = null),
							this.runInAsyncScope(m, null, g || null, {
								opaque: C,
								trailers: v,
							}),
							g && b()
					})
				}
				return (
					f.on("drain", n),
					(this.res = f),
					(f.writableNeedDrain !== void 0 ? f.writableNeedDrain : f._writableState?.needDrain) !== !0
				)
			}
			onData(t) {
				let { res: r } = this
				return r ? r.write(t) : !0
			}
			onComplete(t) {
				let { res: r } = this
				qne(this), r && ((this.trailers = cc.parseHeaders(t)), r.end())
			}
			onError(t) {
				let { res: r, callback: n, opaque: i, body: s } = this
				qne(this),
					(this.factory = null),
					r
						? ((this.res = null), cc.destroy(r, t))
						: n &&
							((this.callback = null),
							queueMicrotask(() => {
								this.runInAsyncScope(n, null, t, { opaque: i })
							})),
					s && ((this.body = null), cc.destroy(s, t))
			}
		}