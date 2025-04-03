
	var { Transform: Uze } = require("stream"),
		{ isASCIINumber: kae, isValidLastEventId: Mae } = n5(),
		Qd = [239, 187, 191],
		i5 = 10,
		ZD = 13,
		Oze = 58,
		qze = 32,
		s5 = class extends Uze {
			state = null
			checkBOM = !0
			crlfCheck = !1
			eventEndCheck = !1
			buffer = null
			pos = 0
			event = { data: void 0, event: void 0, id: void 0, retry: void 0 }
			constructor(t = {}) {
				;(t.readableObjectMode = !0),
					super(t),
					(this.state = t.eventSourceSettings || {}),
					t.push && (this.push = t.push)
			}
			_transform(t, r, n) {
				if (t.length === 0) {
					n()
					return
				}
				if ((this.buffer ? (this.buffer = Buffer.concat([this.buffer, t])) : (this.buffer = t), this.checkBOM))
					switch (this.buffer.length) {
						case 1:
							if (this.buffer[0] === Qd[0]) {
								n()
								return
							}
							;(this.checkBOM = !1), n()
							return
						case 2:
							if (this.buffer[0] === Qd[0] && this.buffer[1] === Qd[1]) {
								n()
								return
							}
							this.checkBOM = !1
							break
						case 3:
							if (this.buffer[0] === Qd[0] && this.buffer[1] === Qd[1] && this.buffer[2] === Qd[2]) {
								;(this.buffer = Buffer.alloc(0)), (this.checkBOM = !1), n()
								return
							}
							this.checkBOM = !1
							break
						default:
							this.buffer[0] === Qd[0] &&
								this.buffer[1] === Qd[1] &&
								this.buffer[2] === Qd[2] &&
								(this.buffer = this.buffer.subarray(3)),
								(this.checkBOM = !1)
							break
					}
				for (; this.pos < this.buffer.length; ) {
					if (this.eventEndCheck) {
						if (this.crlfCheck) {
							if (this.buffer[this.pos] === i5) {
								;(this.buffer = this.buffer.subarray(this.pos + 1)),
									(this.pos = 0),
									(this.crlfCheck = !1)
								continue
							}
							this.crlfCheck = !1
						}
						if (this.buffer[this.pos] === i5 || this.buffer[this.pos] === ZD) {
							this.buffer[this.pos] === ZD && (this.crlfCheck = !0),
								(this.buffer = this.buffer.subarray(this.pos + 1)),
								(this.pos = 0),
								(this.event.data !== void 0 || this.event.event || this.event.id || this.event.retry) &&
									this.processEvent(this.event),
								this.clearEvent()
							continue
						}
						this.eventEndCheck = !1
						continue
					}
					if (this.buffer[this.pos] === i5 || this.buffer[this.pos] === ZD) {
						this.buffer[this.pos] === ZD && (this.crlfCheck = !0),
							this.parseLine(this.buffer.subarray(0, this.pos), this.event),
							(this.buffer = this.buffer.subarray(this.pos + 1)),
							(this.pos = 0),
							(this.eventEndCheck = !0)
						continue
					}
					this.pos++
				}
				n()
			}
			parseLine(t, r) {
				if (t.length === 0) return
				let n = t.indexOf(Oze)
				if (n === 0) return
				let i = "",
					s = ""
				if (n !== -1) {
					i = t.subarray(0, n).toString("utf8")
					let o = n + 1
					t[o] === qze && ++o, (s = t.subarray(o).toString("utf8"))
				} else (i = t.toString("utf8")), (s = "")
				switch (i) {
					case "data":
						r[i] === void 0
							? (r[i] = s)
							: (r[i] += `
${s}`)
						break
					case "retry":
						kae(s) && (r[i] = s)
						break
					case "id":
						Mae(s) && (r[i] = s)
						break
					case "event":
						s.length > 0 && (r[i] = s)
						break
				}
			}
			processEvent(t) {
				t.retry && kae(t.retry) && (this.state.reconnectionTime = parseInt(t.retry, 10)),
					t.id && Mae(t.id) && (this.state.lastEventId = t.id),
					t.data !== void 0 &&
						this.push({
							type: t.event || "message",
							options: {
								data: t.data,
								lastEventId: this.state.lastEventId,
								origin: this.state.origin,
							},
						})
			}
			clearEvent() {
				this.event = { data: void 0, event: void 0, id: void 0, retry: void 0 }
			}
		}