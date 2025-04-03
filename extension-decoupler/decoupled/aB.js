
var Ab = x((xSt, Joe) => {
	"use strict"
	var { kReadyState: gb, kController: CJe, kResponse: vJe, kBinaryType: EJe, kWebSocketURL: bJe } = hb(),
		{ states: pb, opcodes: sh } = Ep(),
		{ ErrorEvent: xJe, createFastMessageEvent: _Je } = R0(),
		{ isUtf8: wJe } = require("buffer"),
		{ collectASequenceOfCodePointsFast: IJe, removeHTTPWhitespace: qoe } = No()
	function SJe(e) {
		return e[gb] === pb.CONNECTING
	}
	function BJe(e) {
		return e[gb] === pb.OPEN
	}
	function DJe(e) {
		return e[gb] === pb.CLOSING
	}
	function TJe(e) {
		return e[gb] === pb.CLOSED
	}
	function YV(e, t, r = (i, s) => new Event(i, s), n = {}) {
		let i = r(e, n)
		t.dispatchEvent(i)
	}
	function RJe(e, t, r) {
		if (e[gb] !== pb.OPEN) return
		let n
		if (t === sh.TEXT)
			try {
				n = Koe(r)
			} catch {
				Hoe(e, "Received invalid UTF-8 in text frame.")
				return
			}
		else t === sh.BINARY && (e[EJe] === "blob" ? (n = new Blob([r])) : (n = kJe(r)))
		YV("message", e, _Je, { origin: e[bJe].origin, data: n })
	}
	function kJe(e) {
		return e.byteLength === e.buffer.byteLength
			? e.buffer
			: e.buffer.slice(e.byteOffset, e.byteOffset + e.byteLength)
	}
	function MJe(e) {
		if (e.length === 0) return !1
		for (let t = 0; t < e.length; ++t) {
			let r = e.charCodeAt(t)
			if (
				r < 33 ||
				r > 126 ||
				r === 34 ||
				r === 40 ||
				r === 41 ||
				r === 44 ||
				r === 47 ||
				r === 58 ||
				r === 59 ||
				r === 60 ||
				r === 61 ||
				r === 62 ||
				r === 63 ||
				r === 64 ||
				r === 91 ||
				r === 92 ||
				r === 93 ||
				r === 123 ||
				r === 125
			)
				return !1
		}
		return !0
	}
	function FJe(e) {
		return e >= 1e3 && e < 1015 ? e !== 1004 && e !== 1005 && e !== 1006 : e >= 3e3 && e <= 4999
	}
	function Hoe(e, t) {
		let { [CJe]: r, [vJe]: n } = e
		r.abort(),
			n?.socket && !n.socket.destroyed && n.socket.destroy(),
			t &&
				YV("error", e, (i, s) => new xJe(i, s), {
					error: new Error(t),
					message: t,
				})
	}
	function Woe(e) {
		return e === sh.CLOSE || e === sh.PING || e === sh.PONG
	}
	function Goe(e) {
		return e === sh.CONTINUATION
	}
	function $oe(e) {
		return e === sh.TEXT || e === sh.BINARY
	}
	function QJe(e) {
		return $oe(e) || Goe(e) || Woe(e)
	}
	function NJe(e) {
		let t = { position: 0 },
			r = new Map()
		for (; t.position < e.length; ) {
			let n = IJe(";", e, t),
				[i, s = ""] = n.split("=")
			r.set(qoe(i, !0, !1), qoe(s, !1, !0)), t.position++
		}
		return r
	}
	function PJe(e) {
		for (let t = 0; t < e.length; t++) {
			let r = e.charCodeAt(t)
			if (r < 48 || r > 57) return !1
		}
		return !0
	}
	var Yoe = typeof process.versions.icu == "string",
		Voe = Yoe ? new TextDecoder("utf-8", { fatal: !0 }) : void 0,
		Koe = Yoe
			? Voe.decode.bind(Voe)
			: function (e) {
					if (wJe(e)) return e.toString("utf-8")
					throw new TypeError("Invalid utf-8 received.")
				}
	Joe.exports = {
		isConnecting: SJe,
		isEstablished: BJe,
		isClosing: DJe,
		isClosed: TJe,
		fireEvent: YV,
		isValidSubprotocol: MJe,
		isValidStatusCode: FJe,
		failWebsocketConnection: Hoe,
		websocketMessageReceived: RJe,
		utf8Decode: Koe,
		isControlFrame: Woe,
		isContinuationFrame: Goe,
		isTextBinaryFrame: $oe,
		isValidOpcode: QJe,
		parseExtensions: NJe,
		isValidClientWindowBits: PJe,
	}
})