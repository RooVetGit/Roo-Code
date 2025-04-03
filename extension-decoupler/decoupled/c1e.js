
var C1e = 6e4,
	OI = class {
		_options
		_transport
		_requestMessageId = 0
		_requestHandlers = new Map()
		_requestHandlerAbortControllers = new Map()
		_notificationHandlers = new Map()
		_responseHandlers = new Map()
		_progressHandlers = new Map()
		onclose
		onerror
		fallbackRequestHandler
		fallbackNotificationHandler
		constructor(t) {
			;(this._options = t),
				this.setNotificationHandler(MI, (r) => {
					this._requestHandlerAbortControllers.get(r.params.requestId)?.abort(r.params.reason)
				}),
				this.setNotificationHandler(QI, (r) => {
					this._onprogress(r)
				}),
				this.setRequestHandler(FI, (r) => ({}))
		}
		async connect(t) {
			;(this._transport = t),
				(this._transport.onclose = () => {
					this._onclose()
				}),
				(this._transport.onerror = (r) => {
					this._onerror(r)
				}),
				(this._transport.onmessage = (r) => {
					"method" in r ? ("id" in r ? this._onrequest(r) : this._onnotification(r)) : this._onresponse(r)
				}),
				await this._transport.start()
		}
		_onclose() {
			let t = this._responseHandlers
			;(this._responseHandlers = new Map()),
				this._progressHandlers.clear(),
				(this._transport = void 0),
				this.onclose?.()
			let r = new lm(qg.ConnectionClosed, "Connection closed")
			for (let n of t.values()) n(r)
		}
		_onerror(t) {
			this.onerror?.(t)
		}
		_onnotification(t) {
			let r = this._notificationHandlers.get(t.method) ?? this.fallbackNotificationHandler
			r !== void 0 &&
				Promise.resolve()
					.then(() => r(t))
					.catch((n) => this._onerror(new Error(`Uncaught error in notification handler: ${n}`)))
		}
		_onrequest(t) {
			let r = this._requestHandlers.get(t.method) ?? this.fallbackRequestHandler
			if (r === void 0) {
				this._transport
					?.send({
						jsonrpc: "2.0",
						id: t.id,
						error: { code: qg.MethodNotFound, message: "Method not found" },
					})
					.catch((i) => this._onerror(new Error(`Failed to send an error response: ${i}`)))
				return
			}
			let n = new AbortController()
			this._requestHandlerAbortControllers.set(t.id, n),
				Promise.resolve()
					.then(() => r(t, { signal: n.signal }))
					.then(
						(i) => {
							if (!n.signal.aborted)
								return this._transport?.send({
									result: i,
									jsonrpc: "2.0",
									id: t.id,
								})
						},
						(i) => {
							if (!n.signal.aborted)
								return this._transport?.send({
									jsonrpc: "2.0",
									id: t.id,
									error: {
										code: Number.isSafeInteger(i.code) ? i.code : qg.InternalError,
										message: i.message ?? "Internal error",
									},
								})
						},
					)
					.catch((i) => this._onerror(new Error(`Failed to send response: ${i}`)))
					.finally(() => {
						this._requestHandlerAbortControllers.delete(t.id)
					})
		}
		_onprogress(t) {
			let { progressToken: r, ...n } = t.params,
				i = this._progressHandlers.get(Number(r))
			if (i === void 0) {
				this._onerror(new Error(`Received a progress notification for an unknown token: ${JSON.stringify(t)}`))
				return
			}
			i(n)
		}
		_onresponse(t) {
			let r = t.id,
				n = this._responseHandlers.get(Number(r))
			if (n === void 0) {
				this._onerror(new Error(`Received a response for an unknown message ID: ${JSON.stringify(t)}`))
				return
			}
			if ((this._responseHandlers.delete(Number(r)), this._progressHandlers.delete(Number(r)), "result" in t))
				n(t)
			else {
				let i = new lm(t.error.code, t.error.message, t.error.data)
				n(i)
			}
		}
		get transport() {
			return this._transport
		}
		async close() {
			await this._transport?.close()
		}
		request(t, r, n) {
			return new Promise((i, s) => {
				if (!this._transport) {
					s(new Error("Not connected"))
					return
				}
				this._options?.enforceStrictCapabilities === !0 && this.assertCapabilityForMethod(t.method),
					n?.signal?.throwIfAborted()
				let o = this._requestMessageId++,
					a = { ...t, jsonrpc: "2.0", id: o }
				n?.onprogress &&
					(this._progressHandlers.set(o, n.onprogress),
					(a.params = { ...t.params, _meta: { progressToken: o } }))
				let l
				this._responseHandlers.set(o, (f) => {
					if ((l !== void 0 && clearTimeout(l), !n?.signal?.aborted)) {
						if (f instanceof Error) return s(f)
						try {
							let p = r.parse(f.result)
							i(p)
						} catch (p) {
							s(p)
						}
					}
				})
				let c = (f) => {
					this._responseHandlers.delete(o),
						this._progressHandlers.delete(o),
						this._transport
							?.send({
								jsonrpc: "2.0",
								method: "notifications/cancelled",
								params: { requestId: o, reason: String(f) },
							})
							.catch((p) => this._onerror(new Error(`Failed to send cancellation: ${p}`))),
						s(f)
				}
				n?.signal?.addEventListener("abort", () => {
					l !== void 0 && clearTimeout(l), c(n?.signal?.reason)
				})
				let u = n?.timeout ?? C1e
				;(l = setTimeout(() => c(new lm(qg.RequestTimeout, "Request timed out", { timeout: u })), u)),
					this._transport.send(a).catch((f) => {
						l !== void 0 && clearTimeout(l), s(f)
					})
			})
		}
		async notification(t) {
			if (!this._transport) throw new Error("Not connected")
			this.assertNotificationCapability(t.method)
			let r = { ...t, jsonrpc: "2.0" }
			await this._transport.send(r)
		}
		setRequestHandler(t, r) {
			let n = t.shape.method.value
			this.assertRequestHandlerCapability(n),
				this._requestHandlers.set(n, (i, s) => Promise.resolve(r(t.parse(i), s)))
		}
		removeRequestHandler(t) {
			this._requestHandlers.delete(t)
		}
		setNotificationHandler(t, r) {
			this._notificationHandlers.set(t.shape.method.value, (n) => Promise.resolve(r(t.parse(n))))
		}
		removeNotificationHandler(t) {
			this._notificationHandlers.delete(t)
		}
	}