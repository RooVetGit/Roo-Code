
	var { pipeline: Vze } = require("stream"),
		{ fetching: Hze } = cb(),
		{ makeRequest: Wze } = w0(),
		{ webidl: Nd } = ys(),
		{ EventSourceStream: Gze } = Qae(),
		{ parseMIMEType: $ze } = No(),
		{ createFastMessageEvent: Yze } = R0(),
		{ isNetworkError: Nae } = ab(),
		{ delay: Kze } = n5(),
		{ kEnumerableProperty: bp } = Xt(),
		{ environmentSettingsObject: Pae } = ga(),
		Lae = !1,
		Uae = 3e3,
		Eb = 0,
		Oae = 1,
		bb = 2,
		Jze = "anonymous",
		zze = "use-credentials",
		N0 = class e extends EventTarget {
			#e = { open: null, error: null, message: null }
			#t = null
			#i = !1
			#n = Eb
			#r = null
			#l = null
			#o
			#u
			constructor(t, r = {}) {
				super(), Nd.util.markAsUncloneable(this)
				let n = "EventSource constructor"
				Nd.argumentLengthCheck(arguments, 1, n),
					Lae ||
						((Lae = !0),
						process.emitWarning("EventSource is experimental, expect them to change at any time.", {
							code: "UNDICI-ES",
						})),
					(t = Nd.converters.USVString(t, n, "url")),
					(r = Nd.converters.EventSourceInitDict(r, n, "eventSourceInitDict")),
					(this.#o = r.dispatcher),
					(this.#u = { lastEventId: "", reconnectionTime: Uae })
				let i = Pae,
					s
				try {
					;(s = new URL(t, i.settingsObject.baseUrl)), (this.#u.origin = s.origin)
				} catch (l) {
					throw new DOMException(l, "SyntaxError")
				}
				this.#t = s.href
				let o = Jze
				r.withCredentials && ((o = zze), (this.#i = !0))
				let a = {
					redirect: "follow",
					keepalive: !0,
					mode: "cors",
					credentials: o === "anonymous" ? "same-origin" : "omit",
					referrer: "no-referrer",
				}
				;(a.client = Pae.settingsObject),
					(a.headersList = [["accept", { name: "accept", value: "text/event-stream" }]]),
					(a.cache = "no-store"),
					(a.initiator = "other"),
					(a.urlList = [new URL(this.#t)]),
					(this.#r = Wze(a)),
					this.#d()
			}
			get readyState() {
				return this.#n
			}
			get url() {
				return this.#t
			}
			get withCredentials() {
				return this.#i
			}
			#d() {
				if (this.#n === bb) return
				this.#n = Eb
				let t = { request: this.#r, dispatcher: this.#o },
					r = (n) => {
						Nae(n) && (this.dispatchEvent(new Event("error")), this.close()), this.#a()
					}
				;(t.processResponseEndOfBody = r),
					(t.processResponse = (n) => {
						if (Nae(n))
							if (n.aborted) {
								this.close(), this.dispatchEvent(new Event("error"))
								return
							} else {
								this.#a()
								return
							}
						let i = n.headersList.get("content-type", !0),
							s = i !== null ? $ze(i) : "failure",
							o = s !== "failure" && s.essence === "text/event-stream"
						if (n.status !== 200 || o === !1) {
							this.close(), this.dispatchEvent(new Event("error"))
							return
						}
						;(this.#n = Oae),
							this.dispatchEvent(new Event("open")),
							(this.#u.origin = n.urlList[n.urlList.length - 1].origin)
						let a = new Gze({
							eventSourceSettings: this.#u,
							push: (l) => {
								this.dispatchEvent(Yze(l.type, l.options))
							},
						})
						Vze(n.body.stream, a, (l) => {
							l?.aborted === !1 && (this.close(), this.dispatchEvent(new Event("error")))
						})
					}),
					(this.#l = Hze(t))
			}
			async #a() {
				this.#n !== bb &&
					((this.#n = Eb),
					this.dispatchEvent(new Event("error")),
					await Kze(this.#u.reconnectionTime),
					this.#n === Eb &&
						(this.#u.lastEventId.length &&
							this.#r.headersList.set("last-event-id", this.#u.lastEventId, !0),
						this.#d()))
			}
			close() {
				Nd.brandCheck(this, e), this.#n !== bb && ((this.#n = bb), this.#l.abort(), (this.#r = null))
			}
			get onopen() {
				return this.#e.open
			}
			set onopen(t) {
				this.#e.open && this.removeEventListener("open", this.#e.open),
					typeof t == "function"
						? ((this.#e.open = t), this.addEventListener("open", t))
						: (this.#e.open = null)
			}
			get onmessage() {
				return this.#e.message
			}
			set onmessage(t) {
				this.#e.message && this.removeEventListener("message", this.#e.message),
					typeof t == "function"
						? ((this.#e.message = t), this.addEventListener("message", t))
						: (this.#e.message = null)
			}
			get onerror() {
				return this.#e.error
			}
			set onerror(t) {
				this.#e.error && this.removeEventListener("error", this.#e.error),
					typeof t == "function"
						? ((this.#e.error = t), this.addEventListener("error", t))
						: (this.#e.error = null)
			}
		},
		qae = {
			CONNECTING: {
				__proto__: null,
				configurable: !1,
				enumerable: !0,
				value: Eb,
				writable: !1,
			},
			OPEN: {
				__proto__: null,
				configurable: !1,
				enumerable: !0,
				value: Oae,
				writable: !1,
			},
			CLOSED: {
				__proto__: null,
				configurable: !1,
				enumerable: !0,
				value: bb,
				writable: !1,
			},
		}