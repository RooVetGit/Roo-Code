
	var { Writable: aze } = require("stream"),
		lze = require("assert"),
		{ parserStates: qo, opcodes: F0, states: cze, emptyBuffer: oae, sentCloseFrameState: aae } = Ep(),
		{ kReadyState: uze, kSentClose: lae, kResponse: cae, kReceivedClose: uae } = hb(),
		{ channels: JD } = $m(),
		{
			isValidStatusCode: dze,
			isValidOpcode: fze,
			failWebsocketConnection: al,
			websocketMessageReceived: dae,
			utf8Decode: hze,
			isControlFrame: fae,
			isTextBinaryFrame: XV,
			isContinuationFrame: gze,
		} = Ab(),
		{ WebsocketFrameSend: hae } = WD(),
		{ closeWebSocketConnection: gae } = jV(),
		{ PerMessageDeflate: pze } = sae(),
		e5 = class extends aze {
			#e = []
			#t = 0
			#i = !1
			#n = qo.INFO
			#r = {}
			#l = []
			#o
			constructor(t, r) {
				super(),
					(this.ws = t),
					(this.#o = r ?? new Map()),
					this.#o.has("permessage-deflate") && this.#o.set("permessage-deflate", new pze(r))
			}
			_write(t, r, n) {
				this.#e.push(t), (this.#t += t.length), (this.#i = !0), this.run(n)
			}
			run(t) {
				for (; this.#i; )
					if (this.#n === qo.INFO) {
						if (this.#t < 2) return t()
						let r = this.consume(2),
							n = (r[0] & 128) !== 0,
							i = r[0] & 15,
							s = (r[1] & 128) === 128,
							o = !n && i !== F0.CONTINUATION,
							a = r[1] & 127,
							l = r[0] & 64,
							c = r[0] & 32,
							u = r[0] & 16
						if (!fze(i)) return al(this.ws, "Invalid opcode received"), t()
						if (s) return al(this.ws, "Frame cannot be masked"), t()
						if (l !== 0 && !this.#o.has("permessage-deflate")) {
							al(this.ws, "Expected RSV1 to be clear.")
							return
						}
						if (c !== 0 || u !== 0) {
							al(this.ws, "RSV1, RSV2, RSV3 must be clear")
							return
						}
						if (o && !XV(i)) {
							al(this.ws, "Invalid frame type was fragmented.")
							return
						}
						if (XV(i) && this.#l.length > 0) {
							al(this.ws, "Expected continuation frame")
							return
						}
						if (this.#r.fragmented && o) {
							al(this.ws, "Fragmented frame exceeded 125 bytes.")
							return
						}
						if ((a > 125 || o) && fae(i)) {
							al(this.ws, "Control frame either too large or fragmented")
							return
						}
						if (gze(i) && this.#l.length === 0 && !this.#r.compressed) {
							al(this.ws, "Unexpected continuation frame")
							return
						}
						a <= 125
							? ((this.#r.payloadLength = a), (this.#n = qo.READ_DATA))
							: a === 126
								? (this.#n = qo.PAYLOADLENGTH_16)
								: a === 127 && (this.#n = qo.PAYLOADLENGTH_64),
							XV(i) && ((this.#r.binaryType = i), (this.#r.compressed = l !== 0)),
							(this.#r.opcode = i),
							(this.#r.masked = s),
							(this.#r.fin = n),
							(this.#r.fragmented = o)
					} else if (this.#n === qo.PAYLOADLENGTH_16) {
						if (this.#t < 2) return t()
						let r = this.consume(2)
						;(this.#r.payloadLength = r.readUInt16BE(0)), (this.#n = qo.READ_DATA)
					} else if (this.#n === qo.PAYLOADLENGTH_64) {
						if (this.#t < 8) return t()
						let r = this.consume(8),
							n = r.readUInt32BE(0)
						if (n > 2 ** 31 - 1) {
							al(this.ws, "Received payload length > 2^31 bytes.")
							return
						}
						let i = r.readUInt32BE(4)
						;(this.#r.payloadLength = (n << 8) + i), (this.#n = qo.READ_DATA)
					} else if (this.#n === qo.READ_DATA) {
						if (this.#t < this.#r.payloadLength) return t()
						let r = this.consume(this.#r.payloadLength)
						if (fae(this.#r.opcode)) (this.#i = this.parseControlFrame(r)), (this.#n = qo.INFO)
						else if (this.#r.compressed) {
							this.#o.get("permessage-deflate").decompress(r, this.#r.fin, (n, i) => {
								if (n) {
									gae(this.ws, 1007, n.message, n.message.length)
									return
								}
								if ((this.#l.push(i), !this.#r.fin)) {
									;(this.#n = qo.INFO), (this.#i = !0), this.run(t)
									return
								}
								dae(this.ws, this.#r.binaryType, Buffer.concat(this.#l)),
									(this.#i = !0),
									(this.#n = qo.INFO),
									(this.#l.length = 0),
									this.run(t)
							}),
								(this.#i = !1)
							break
						} else {
							if ((this.#l.push(r), !this.#r.fragmented && this.#r.fin)) {
								let n = Buffer.concat(this.#l)
								dae(this.ws, this.#r.binaryType, n), (this.#l.length = 0)
							}
							this.#n = qo.INFO
						}
					}
			}
			consume(t) {
				if (t > this.#t) throw new Error("Called consume() before buffers satiated.")
				if (t === 0) return oae
				if (this.#e[0].length === t) return (this.#t -= this.#e[0].length), this.#e.shift()
				let r = Buffer.allocUnsafe(t),
					n = 0
				for (; n !== t; ) {
					let i = this.#e[0],
						{ length: s } = i
					if (s + n === t) {
						r.set(this.#e.shift(), n)
						break
					} else if (s + n > t) {
						r.set(i.subarray(0, t - n), n), (this.#e[0] = i.subarray(t - n))
						break
					} else r.set(this.#e.shift(), n), (n += i.length)
				}
				return (this.#t -= t), r
			}
			parseCloseBody(t) {
				lze(t.length !== 1)
				let r
				if ((t.length >= 2 && (r = t.readUInt16BE(0)), r !== void 0 && !dze(r)))
					return { code: 1002, reason: "Invalid status code", error: !0 }
				let n = t.subarray(2)
				n[0] === 239 && n[1] === 187 && n[2] === 191 && (n = n.subarray(3))
				try {
					n = hze(n)
				} catch {
					return { code: 1007, reason: "Invalid UTF-8", error: !0 }
				}
				return { code: r, reason: n, error: !1 }
			}
			parseControlFrame(t) {
				let { opcode: r, payloadLength: n } = this.#r
				if (r === F0.CLOSE) {
					if (n === 1) return al(this.ws, "Received close frame with a 1-byte body."), !1
					if (((this.#r.closeInfo = this.parseCloseBody(t)), this.#r.closeInfo.error)) {
						let { code: i, reason: s } = this.#r.closeInfo
						return gae(this.ws, i, s, s.length), al(this.ws, s), !1
					}
					if (this.ws[lae] !== aae.SENT) {
						let i = oae
						this.#r.closeInfo.code &&
							((i = Buffer.allocUnsafe(2)), i.writeUInt16BE(this.#r.closeInfo.code, 0))
						let s = new hae(i)
						this.ws[cae].socket.write(s.createFrame(F0.CLOSE), (o) => {
							o || (this.ws[lae] = aae.SENT)
						})
					}
					return (this.ws[uze] = cze.CLOSING), (this.ws[uae] = !0), !1
				} else if (r === F0.PING) {
					if (!this.ws[uae]) {
						let i = new hae(t)
						this.ws[cae].socket.write(i.createFrame(F0.PONG)),
							JD.ping.hasSubscribers && JD.ping.publish({ payload: t })
					}
				} else r === F0.PONG && JD.pong.hasSubscribers && JD.pong.publish({ payload: t })
				return !0
			}
			get closingInfo() {
				return this.#r.closeInfo
			}
		}