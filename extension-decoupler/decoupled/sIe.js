
var sie = x((NIt, iie) => {
	"use strict"
	var I9e = require("assert"),
		{ AsyncResource: S9e } = require("async_hooks"),
		{ InvalidArgumentError: Jq, SocketError: B9e } = Vr(),
		tie = Xt(),
		{ addSignal: D9e, removeSignal: rie } = rb(),
		zq = class extends S9e {
			constructor(t, r) {
				if (!t || typeof t != "object") throw new Jq("invalid opts")
				if (typeof r != "function") throw new Jq("invalid callback")
				let { signal: n, opaque: i, responseHeaders: s } = t
				if (n && typeof n.on != "function" && typeof n.addEventListener != "function")
					throw new Jq("signal must be an EventEmitter or EventTarget")
				super("UNDICI_CONNECT"),
					(this.opaque = i || null),
					(this.responseHeaders = s || null),
					(this.callback = r),
					(this.abort = null),
					D9e(this, n)
			}
			onConnect(t, r) {
				if (this.reason) {
					t(this.reason)
					return
				}
				I9e(this.callback), (this.abort = t), (this.context = r)
			}
			onHeaders() {
				throw new B9e("bad connect", null)
			}
			onUpgrade(t, r, n) {
				let { callback: i, opaque: s, context: o } = this
				rie(this), (this.callback = null)
				let a = r
				a != null && (a = this.responseHeaders === "raw" ? tie.parseRawHeaders(r) : tie.parseHeaders(r)),
					this.runInAsyncScope(i, null, null, {
						statusCode: t,
						headers: a,
						socket: n,
						opaque: s,
						context: o,
					})
			}
			onError(t) {
				let { callback: r, opaque: n } = this
				rie(this),
					r &&
						((this.callback = null),
						queueMicrotask(() => {
							this.runInAsyncScope(r, null, t, { opaque: n })
						}))
			}
		}
	function nie(e, t) {
		if (t === void 0)
			return new Promise((r, n) => {
				nie.call(this, e, (i, s) => (i ? n(i) : r(s)))
			})
		try {
			let r = new zq(e, t)
			this.dispatch({ ...e, method: "CONNECT" }, r)
		} catch (r) {
			if (typeof t != "function") throw r
			let n = e?.opaque
			queueMicrotask(() => t(r, { opaque: n }))
		}
	}
	iie.exports = nie
})