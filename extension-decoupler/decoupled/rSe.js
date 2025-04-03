
	var Rse = !1,
		rh = class e {
			constructor(t, r = {}) {
				if ((gt.util.markAsUncloneable(this), t === bD)) return
				let n = "Request constructor"
				gt.argumentLengthCheck(arguments, 1, n),
					(t = gt.converters.RequestInfo(t, n, "input")),
					(r = gt.converters.RequestInit(r, n, "init"))
				let i = null,
					s = null,
					o = yD.settingsObject.baseUrl,
					a = null
				if (typeof t == "string") {
					this[DV] = r.dispatcher
					let v
					try {
						v = new URL(t, o)
					} catch (b) {
						throw new TypeError("Failed to parse URL from " + t, { cause: b })
					}
					if (v.username || v.password)
						throw new TypeError("Request cannot be constructed from a URL that includes credentials: " + t)
					;(i = _D({ urlList: [v] })), (s = "cors")
				} else (this[DV] = r.dispatcher || t[DV]), xYe(t instanceof e), (i = t[xn]), (a = t[vD])
				let l = yD.settingsObject.origin,
					c = "client"
				if (
					(i.window?.constructor?.name === "EnvironmentSettingsObject" && Ise(i.window, l) && (c = i.window),
					r.window != null)
				)
					throw new TypeError(`'window' option '${c}' must be null`)
				"window" in r && (c = "no-window"),
					(i = _D({
						method: i.method,
						headersList: i.headersList,
						unsafeRequest: i.unsafeRequest,
						client: yD.settingsObject,
						window: c,
						priority: i.priority,
						origin: i.origin,
						referrer: i.referrer,
						referrerPolicy: i.referrerPolicy,
						mode: i.mode,
						credentials: i.credentials,
						cache: i.cache,
						redirect: i.redirect,
						integrity: i.integrity,
						keepalive: i.keepalive,
						reloadNavigation: i.reloadNavigation,
						historyNavigation: i.historyNavigation,
						urlList: [...i.urlList],
					}))
				let u = Object.keys(r).length !== 0
				if (
					(u &&
						(i.mode === "navigate" && (i.mode = "same-origin"),
						(i.reloadNavigation = !1),
						(i.historyNavigation = !1),
						(i.origin = "client"),
						(i.referrer = "client"),
						(i.referrerPolicy = ""),
						(i.url = i.urlList[i.urlList.length - 1]),
						(i.urlList = [i.url])),
					r.referrer !== void 0)
				) {
					let v = r.referrer
					if (v === "") i.referrer = "no-referrer"
					else {
						let b
						try {
							b = new URL(v, o)
						} catch (w) {
							throw new TypeError(`Referrer "${v}" is not a valid URL.`, {
								cause: w,
							})
						}
						;(b.protocol === "about:" && b.hostname === "client") ||
						(l && !Ise(b, yD.settingsObject.baseUrl))
							? (i.referrer = "client")
							: (i.referrer = b)
					}
				}
				r.referrerPolicy !== void 0 && (i.referrerPolicy = r.referrerPolicy)
				let f
				if ((r.mode !== void 0 ? (f = r.mode) : (f = s), f === "navigate"))
					throw gt.errors.exception({
						header: "Request constructor",
						message: "invalid request mode navigate.",
					})
				if (
					(f != null && (i.mode = f),
					r.credentials !== void 0 && (i.credentials = r.credentials),
					r.cache !== void 0 && (i.cache = r.cache),
					i.cache === "only-if-cached" && i.mode !== "same-origin")
				)
					throw new TypeError("'only-if-cached' can be set only with 'same-origin' mode")
				if (
					(r.redirect !== void 0 && (i.redirect = r.redirect),
					r.integrity != null && (i.integrity = String(r.integrity)),
					r.keepalive !== void 0 && (i.keepalive = !!r.keepalive),
					r.method !== void 0)
				) {
					let v = r.method,
						b = EYe[v]
					if (b !== void 0) i.method = b
					else {
						if (!dYe(v)) throw new TypeError(`'${v}' is not a valid HTTP method.`)
						let w = v.toUpperCase()
						if (fYe.has(w)) throw new TypeError(`'${v}' HTTP method is unsupported.`)
						;(v = vYe[w] ?? v), (i.method = v)
					}
					!Rse &&
						i.method === "patch" &&
						(process.emitWarning(
							"Using `patch` is highly likely to result in a `405 Method Not Allowed`. `PATCH` is much more likely to succeed.",
							{ code: "UNDICI-FETCH-patch" },
						),
						(Rse = !0))
				}
				r.signal !== void 0 && (a = r.signal), (this[xn] = i)
				let p = new AbortController()
				if (((this[vD] = p.signal), a != null)) {
					if (!a || typeof a.aborted != "boolean" || typeof a.addEventListener != "function")
						throw new TypeError("Failed to construct 'Request': member signal is not of type AbortSignal.")
					if (a.aborted) p.abort(a.reason)
					else {
						this[wYe] = p
						let v = new WeakRef(p),
							b = Tse(v)
						try {
							;((typeof Sse == "function" && Sse(a) === Dse) || _Ye(a, "abort").length >= Dse) &&
								Bse(1500, a)
						} catch {}
						CD.addAbortListener(a, b), Fse.register(p, { signal: a, abort: b }, b)
					}
				}
				if (
					((this[Ca] = new kse(bD)), Mse(this[Ca], i.headersList), TV(this[Ca], "request"), f === "no-cors")
				) {
					if (!hYe.has(i.method)) throw new TypeError(`'${i.method} is unsupported in no-cors mode.`)
					TV(this[Ca], "request-no-cors")
				}
				if (u) {
					let v = _se(this[Ca]),
						b = r.headers !== void 0 ? r.headers : new ED(v)
					if ((v.clear(), b instanceof ED)) {
						for (let { name: w, value: B } of b.rawValues()) v.append(w, B, !1)
						v.cookies = b.cookies
					} else lYe(this[Ca], b)
				}
				let g = t instanceof e ? t[xn].body : null
				if ((r.body != null || g != null) && (i.method === "GET" || i.method === "HEAD"))
					throw new TypeError("Request with GET/HEAD method cannot have body.")
				let m = null
				if (r.body != null) {
					let [v, b] = sYe(r.body, i.keepalive)
					;(m = v), b && !_se(this[Ca]).contains("content-type", !0) && this[Ca].append("content-type", b)
				}
				let y = m ?? g
				if (y != null && y.source == null) {
					if (m != null && r.duplex == null)
						throw new TypeError("RequestInit: duplex option is required when sending a body.")
					if (i.mode !== "same-origin" && i.mode !== "cors")
						throw new TypeError(
							'If request is made from ReadableStream, mode should be "same-origin" or "cors"',
						)
					i.useCORSPreflightFlag = !0
				}
				let C = y
				if (m == null && g != null) {
					if (xse(t))
						throw new TypeError(
							"Cannot construct a Request with a Request object that has already been used.",
						)
					let v = new TransformStream()
					g.stream.pipeThrough(v), (C = { source: g.source, length: g.length, stream: v.readable })
				}
				this[xn].body = C
			}
			get method() {
				return gt.brandCheck(this, e), this[xn].method
			}
			get url() {
				return gt.brandCheck(this, e), bYe(this[xn].url)
			}
			get headers() {
				return gt.brandCheck(this, e), this[Ca]
			}
			get destination() {
				return gt.brandCheck(this, e), this[xn].destination
			}
			get referrer() {
				return (
					gt.brandCheck(this, e),
					this[xn].referrer === "no-referrer"
						? ""
						: this[xn].referrer === "client"
							? "about:client"
							: this[xn].referrer.toString()
				)
			}
			get referrerPolicy() {
				return gt.brandCheck(this, e), this[xn].referrerPolicy
			}
			get mode() {
				return gt.brandCheck(this, e), this[xn].mode
			}
			get credentials() {
				return this[xn].credentials
			}
			get cache() {
				return gt.brandCheck(this, e), this[xn].cache
			}
			get redirect() {
				return gt.brandCheck(this, e), this[xn].redirect
			}
			get integrity() {
				return gt.brandCheck(this, e), this[xn].integrity
			}
			get keepalive() {
				return gt.brandCheck(this, e), this[xn].keepalive
			}
			get isReloadNavigation() {
				return gt.brandCheck(this, e), this[xn].reloadNavigation
			}
			get isHistoryNavigation() {
				return gt.brandCheck(this, e), this[xn].historyNavigation
			}
			get signal() {
				return gt.brandCheck(this, e), this[vD]
			}
			get body() {
				return gt.brandCheck(this, e), this[xn].body ? this[xn].body.stream : null
			}
			get bodyUsed() {
				return gt.brandCheck(this, e), !!this[xn].body && CD.isDisturbed(this[xn].body.stream)
			}
			get duplex() {
				return gt.brandCheck(this, e), "half"
			}
			clone() {
				if ((gt.brandCheck(this, e), xse(this))) throw new TypeError("unusable")
				let t = Qse(this[xn]),
					r = new AbortController()
				if (this.signal.aborted) r.abort(this.signal.reason)
				else {
					let n = xD.get(this.signal)
					n === void 0 && ((n = new Set()), xD.set(this.signal, n))
					let i = new WeakRef(r)
					n.add(i), CD.addAbortListener(r.signal, Tse(i))
				}
				return Nse(t, r.signal, cYe(this[Ca]))
			}
			[wse.inspect.custom](t, r) {
				r.depth === null && (r.depth = 2), (r.colors ??= !0)
				let n = {
					method: this.method,
					url: this.url,
					headers: this.headers,
					destination: this.destination,
					referrer: this.referrer,
					referrerPolicy: this.referrerPolicy,
					mode: this.mode,
					credentials: this.credentials,
					cache: this.cache,
					redirect: this.redirect,
					integrity: this.integrity,
					keepalive: this.keepalive,
					isReloadNavigation: this.isReloadNavigation,
					isHistoryNavigation: this.isHistoryNavigation,
					signal: this.signal,
				}
				return `Request ${wse.formatWithOptions(r, n)}`
			}
		}