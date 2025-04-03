
var jV = x((wSt, nae) => {
	"use strict"
	var { uid: OJe, states: yb, sentCloseFrameState: GD, emptyBuffer: qJe, opcodes: VJe } = Ep(),
		{ kReadyState: Cb, kSentClose: $D, kByteParser: Zoe, kReceivedClose: joe, kResponse: Xoe } = hb(),
		{
			fireEvent: HJe,
			failWebsocketConnection: oh,
			isClosing: WJe,
			isClosed: GJe,
			isEstablished: $Je,
			parseExtensions: YJe,
		} = Ab(),
		{ channels: M0 } = $m(),
		{ CloseEvent: KJe } = R0(),
		{ makeRequest: JJe } = w0(),
		{ fetching: zJe } = cb(),
		{ Headers: jJe, getHeadersList: ZJe } = pp(),
		{ getDecodeSplit: XJe } = ga(),
		{ WebsocketFrameSend: eze } = WD(),
		zV
	try {
		zV = require("crypto")
	} catch {}
	function tze(e, t, r, n, i, s) {
		let o = e
		o.protocol = e.protocol === "ws:" ? "http:" : "https:"
		let a = JJe({
			urlList: [o],
			client: r,
			serviceWorkers: "none",
			referrer: "no-referrer",
			mode: "websocket",
			credentials: "include",
			cache: "no-store",
			redirect: "error",
		})
		if (s.headers) {
			let f = ZJe(new jJe(s.headers))
			a.headersList = f
		}
		let l = zV.randomBytes(16).toString("base64")
		a.headersList.append("sec-websocket-key", l), a.headersList.append("sec-websocket-version", "13")
		for (let f of t) a.headersList.append("sec-websocket-protocol", f)
		let c = "permessage-deflate; client_max_window_bits"
		return (
			a.headersList.append("sec-websocket-extensions", c),
			zJe({
				request: a,
				useParallelQueue: !0,
				dispatcher: s.dispatcher,
				processResponse(f) {
					if (f.type === "error" || f.status !== 101) {
						oh(n, "Received network error or non-101 status code.")
						return
					}
					if (t.length !== 0 && !f.headersList.get("Sec-WebSocket-Protocol")) {
						oh(n, "Server did not respond with sent protocols.")
						return
					}
					if (f.headersList.get("Upgrade")?.toLowerCase() !== "websocket") {
						oh(n, 'Server did not set Upgrade header to "websocket".')
						return
					}
					if (f.headersList.get("Connection")?.toLowerCase() !== "upgrade") {
						oh(n, 'Server did not set Connection header to "upgrade".')
						return
					}
					let p = f.headersList.get("Sec-WebSocket-Accept"),
						g = zV
							.createHash("sha1")
							.update(l + OJe)
							.digest("base64")
					if (p !== g) {
						oh(n, "Incorrect hash received in Sec-WebSocket-Accept header.")
						return
					}
					let m = f.headersList.get("Sec-WebSocket-Extensions"),
						y
					if (m !== null && ((y = YJe(m)), !y.has("permessage-deflate"))) {
						oh(n, "Sec-WebSocket-Extensions header does not match.")
						return
					}
					let C = f.headersList.get("Sec-WebSocket-Protocol")
					if (C !== null && !XJe("sec-websocket-protocol", a.headersList).includes(C)) {
						oh(n, "Protocol was not set in the opening handshake.")
						return
					}
					f.socket.on("data", eae),
						f.socket.on("close", tae),
						f.socket.on("error", rae),
						M0.open.hasSubscribers &&
							M0.open.publish({
								address: f.socket.address(),
								protocol: C,
								extensions: m,
							}),
						i(f, y)
				},
			})
		)
	}
	function rze(e, t, r, n) {
		if (!(WJe(e) || GJe(e)))
			if (!$Je(e)) oh(e, "Connection was closed before it was established."), (e[Cb] = yb.CLOSING)
			else if (e[$D] === GD.NOT_SENT) {
				e[$D] = GD.PROCESSING
				let i = new eze()
				t !== void 0 && r === void 0
					? ((i.frameData = Buffer.allocUnsafe(2)), i.frameData.writeUInt16BE(t, 0))
					: t !== void 0 && r !== void 0
						? ((i.frameData = Buffer.allocUnsafe(2 + n)),
							i.frameData.writeUInt16BE(t, 0),
							i.frameData.write(r, 2, "utf-8"))
						: (i.frameData = qJe),
					e[Xoe].socket.write(i.createFrame(VJe.CLOSE)),
					(e[$D] = GD.SENT),
					(e[Cb] = yb.CLOSING)
			} else e[Cb] = yb.CLOSING
	}
	function eae(e) {
		this.ws[Zoe].write(e) || this.pause()
	}
	function tae() {
		let { ws: e } = this,
			{ [Xoe]: t } = e
		t.socket.off("data", eae), t.socket.off("close", tae), t.socket.off("error", rae)
		let r = e[$D] === GD.SENT && e[joe],
			n = 1005,
			i = "",
			s = e[Zoe].closingInfo
		s && !s.error ? ((n = s.code ?? 1005), (i = s.reason)) : e[joe] || (n = 1006),
			(e[Cb] = yb.CLOSED),
			HJe("close", e, (o, a) => new KJe(o, a), {
				wasClean: r,
				code: n,
				reason: i,
			}),
			M0.close.hasSubscribers && M0.close.publish({ websocket: e, code: n, reason: i })
	}
	function rae(e) {
		let { ws: t } = this
		;(t[Cb] = yb.CLOSING), M0.socketError.hasSubscribers && M0.socketError.publish(e), this.destroy()
	}
	nae.exports = {
		establishWebSocketConnection: tze,
		closeWebSocketConnection: rze,
	}
})