
	var { Readable: $ne, Duplex: A9e, PassThrough: m9e } = require("stream"),
		{ InvalidArgumentError: nb, InvalidReturnValueError: y9e, RequestAbortedError: Hq } = Vr(),
		ol = Xt(),
		{ AsyncResource: C9e } = require("async_hooks"),
		{ addSignal: v9e, removeSignal: E9e } = rb(),
		Gne = require("assert"),
		y0 = Symbol("resume"),
		Wq = class extends $ne {
			constructor() {
				super({ autoDestroy: !0 }), (this[y0] = null)
			}
			_read() {
				let { [y0]: t } = this
				t && ((this[y0] = null), t())
			}
			_destroy(t, r) {
				this._read(), r(t)
			}
		},
		Gq = class extends $ne {
			constructor(t) {
				super({ autoDestroy: !0 }), (this[y0] = t)
			}
			_read() {
				this[y0]()
			}
			_destroy(t, r) {
				!t && !this._readableState.endEmitted && (t = new Hq()), r(t)
			}
		},
		$q = class extends C9e {
			constructor(t, r) {
				if (!t || typeof t != "object") throw new nb("invalid opts")
				if (typeof r != "function") throw new nb("invalid handler")
				let { signal: n, method: i, opaque: s, onInfo: o, responseHeaders: a } = t
				if (n && typeof n.on != "function" && typeof n.addEventListener != "function")
					throw new nb("signal must be an EventEmitter or EventTarget")
				if (i === "CONNECT") throw new nb("invalid method")
				if (o && typeof o != "function") throw new nb("invalid onInfo callback")
				super("UNDICI_PIPELINE"),
					(this.opaque = s || null),
					(this.responseHeaders = a || null),
					(this.handler = r),
					(this.abort = null),
					(this.context = null),
					(this.onInfo = o || null),
					(this.req = new Wq().on("error", ol.nop)),
					(this.ret = new A9e({
						readableObjectMode: t.objectMode,
						autoDestroy: !0,
						read: () => {
							let { body: l } = this
							l?.resume && l.resume()
						},
						write: (l, c, u) => {
							let { req: f } = this
							f.push(l, c) || f._readableState.destroyed ? u() : (f[y0] = u)
						},
						destroy: (l, c) => {
							let { body: u, req: f, res: p, ret: g, abort: m } = this
							!l && !g._readableState.endEmitted && (l = new Hq()),
								m && l && m(),
								ol.destroy(u, l),
								ol.destroy(f, l),
								ol.destroy(p, l),
								E9e(this),
								c(l)
						},
					}).on("prefinish", () => {
						let { req: l } = this
						l.push(null)
					})),
					(this.res = null),
					v9e(this, n)
			}
			onConnect(t, r) {
				let { ret: n, res: i } = this
				if (this.reason) {
					t(this.reason)
					return
				}
				Gne(!i, "pipeline cannot be retried"), Gne(!n.destroyed), (this.abort = t), (this.context = r)
			}
			onHeaders(t, r, n) {
				let { opaque: i, handler: s, context: o } = this
				if (t < 200) {
					if (this.onInfo) {
						let l = this.responseHeaders === "raw" ? ol.parseRawHeaders(r) : ol.parseHeaders(r)
						this.onInfo({ statusCode: t, headers: l })
					}
					return
				}
				this.res = new Gq(n)
				let a
				try {
					this.handler = null
					let l = this.responseHeaders === "raw" ? ol.parseRawHeaders(r) : ol.parseHeaders(r)
					a = this.runInAsyncScope(s, null, {
						statusCode: t,
						headers: l,
						opaque: i,
						body: this.res,
						context: o,
					})
				} catch (l) {
					throw (this.res.on("error", ol.nop), l)
				}
				if (!a || typeof a.on != "function") throw new y9e("expected Readable")
				a
					.on("data", (l) => {
						let { ret: c, body: u } = this
						!c.push(l) && u.pause && u.pause()
					})
					.on("error", (l) => {
						let { ret: c } = this
						ol.destroy(c, l)
					})
					.on("end", () => {
						let { ret: l } = this
						l.push(null)
					})
					.on("close", () => {
						let { ret: l } = this
						l._readableState.ended || ol.destroy(l, new Hq())
					}),
					(this.body = a)
			}
			onData(t) {
				let { res: r } = this
				return r.push(t)
			}
			onComplete(t) {
				let { res: r } = this
				r.push(null)
			}
			onError(t) {
				let { ret: r } = this
				;(this.handler = null), ol.destroy(r, t)
			}
		}