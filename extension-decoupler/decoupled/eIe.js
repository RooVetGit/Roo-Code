
var eie = x((QIt, Xne) => {
	"use strict"
	var { InvalidArgumentError: Yq, SocketError: x9e } = Vr(),
		{ AsyncResource: _9e } = require("async_hooks"),
		Jne = Xt(),
		{ addSignal: w9e, removeSignal: zne } = rb(),
		jne = require("assert"),
		Kq = class extends _9e {
			constructor(t, r) {
				if (!t || typeof t != "object") throw new Yq("invalid opts")
				if (typeof r != "function") throw new Yq("invalid callback")
				let { signal: n, opaque: i, responseHeaders: s } = t
				if (n && typeof n.on != "function" && typeof n.addEventListener != "function")
					throw new Yq("signal must be an EventEmitter or EventTarget")
				super("UNDICI_UPGRADE"),
					(this.responseHeaders = s || null),
					(this.opaque = i || null),
					(this.callback = r),
					(this.abort = null),
					(this.context = null),
					w9e(this, n)
			}
			onConnect(t, r) {
				if (this.reason) {
					t(this.reason)
					return
				}
				jne(this.callback), (this.abort = t), (this.context = null)
			}
			onHeaders() {
				throw new x9e("bad upgrade", null)
			}
			onUpgrade(t, r, n) {
				jne(t === 101)
				let { callback: i, opaque: s, context: o } = this
				zne(this), (this.callback = null)
				let a = this.responseHeaders === "raw" ? Jne.parseRawHeaders(r) : Jne.parseHeaders(r)
				this.runInAsyncScope(i, null, null, {
					headers: a,
					socket: n,
					opaque: s,
					context: o,
				})
			}
			onError(t) {
				let { callback: r, opaque: n } = this
				zne(this),
					r &&
						((this.callback = null),
						queueMicrotask(() => {
							this.runInAsyncScope(r, null, t, { opaque: n })
						}))
			}
		}
	function Zne(e, t) {
		if (t === void 0)
			return new Promise((r, n) => {
				Zne.call(this, e, (i, s) => (i ? n(i) : r(s)))
			})
		try {
			let r = new Kq(e, t)
			this.dispatch({ ...e, method: e.method || "GET", upgrade: e.protocol || "Websocket" }, r)
		} catch (r) {
			if (typeof t != "function") throw r
			let n = e?.opaque
			queueMicrotask(() => t(r, { opaque: n }))
		}
	}
	Xne.exports = Zne
})