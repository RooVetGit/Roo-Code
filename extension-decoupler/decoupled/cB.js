
var cb = x((oSt, Zse) => {
	"use strict"
	var {
			makeNetworkError: nn,
			makeAppropriateNetworkError: wD,
			filterResponse: RV,
			makeResponse: ID,
			fromInnerResponse: IYe,
		} = ab(),
		{ HeadersList: Lse } = pp(),
		{ Request: SYe, cloneRequest: BYe } = w0(),
		nh = require("zlib"),
		{
			bytesMatch: DYe,
			makePolicyContainer: TYe,
			clonePolicyContainer: RYe,
			requestBadPort: kYe,
			TAOCheck: MYe,
			appendRequestOriginHeader: FYe,
			responseLocationURL: QYe,
			requestCurrentURL: uu,
			setRequestReferrerPolicyOnRedirect: NYe,
			tryUpgradeRequestToAPotentiallyTrustworthyURL: PYe,
			createOpaqueTimingInfo: NV,
			appendFetchMetadata: LYe,
			corsCheck: UYe,
			crossOriginResourcePolicyCheck: OYe,
			determineRequestsReferrer: qYe,
			coarsenedSharedCurrentTime: lb,
			createDeferredPromise: VYe,
			isBlobLike: HYe,
			sameOrigin: QV,
			isCancelled: mp,
			isAborted: Use,
			isErrorLike: WYe,
			fullyReadBody: GYe,
			readableStreamClose: $Ye,
			isomorphicEncode: SD,
			urlIsLocal: YYe,
			urlIsHttpHttpsScheme: PV,
			urlHasHttpsScheme: KYe,
			clampAndCoarsenConnectionTimingInfo: JYe,
			simpleRangeHeaderValue: zYe,
			buildContentRange: jYe,
			createInflate: ZYe,
			extractMimeType: XYe,
		} = ga(),
		{ kState: Hse, kDispatcher: eKe } = Gf(),
		yp = require("assert"),
		{ safelyExtractBody: LV, extractBody: Ose } = s0(),
		{
			redirectStatusSet: Wse,
			nullBodyStatus: Gse,
			safeMethodsSet: tKe,
			requestBodyHeader: rKe,
			subresourceSet: nKe,
		} = SE(),
		iKe = require("events"),
		{ Readable: sKe, pipeline: oKe, finished: aKe } = require("stream"),
		{ addAbortListener: lKe, isErrored: cKe, isReadable: BD, bufferToLowerCasedHeaderName: qse } = Xt(),
		{ dataURLProcessor: uKe, serializeAMimeType: dKe, minimizeSupportedMimeType: fKe } = No(),
		{ getGlobalDispatcher: hKe } = dD(),
		{ webidl: gKe } = ys(),
		{ STATUS_CODES: pKe } = require("http"),
		AKe = ["GET", "HEAD"],
		mKe = typeof __UNDICI_IS_NODE__ < "u" || typeof esbuildDetection < "u" ? "node" : "undici",
		kV,
		DD = class extends iKe {
			constructor(t) {
				super(), (this.dispatcher = t), (this.connection = null), (this.dump = !1), (this.state = "ongoing")
			}
			terminate(t) {
				this.state === "ongoing" &&
					((this.state = "terminated"), this.connection?.destroy(t), this.emit("terminated", t))
			}
			abort(t) {
				this.state === "ongoing" &&
					((this.state = "aborted"),
					t || (t = new DOMException("The operation was aborted.", "AbortError")),
					(this.serializedAbortReason = t),
					this.connection?.destroy(t),
					this.emit("terminated", t))
			}
		}
	function yKe(e) {
		$se(e, "fetch")
	}
	function CKe(e, t = void 0) {
		gKe.argumentLengthCheck(arguments, 1, "globalThis.fetch")
		let r = VYe(),
			n
		try {
			n = new SYe(e, t)
		} catch (u) {
			return r.reject(u), r.promise
		}
		let i = n[Hse]
		if (n.signal.aborted) return MV(r, i, null, n.signal.reason), r.promise
		i.client.globalObject?.constructor?.name === "ServiceWorkerGlobalScope" && (i.serviceWorkers = "none")
		let o = null,
			a = !1,
			l = null
		return (
			lKe(n.signal, () => {
				;(a = !0), yp(l != null), l.abort(n.signal.reason)
				let u = o?.deref()
				MV(r, i, u, n.signal.reason)
			}),
			(l = Kse({
				request: i,
				processResponseEndOfBody: yKe,
				processResponse: (u) => {
					if (!a) {
						if (u.aborted) {
							MV(r, i, o, l.serializedAbortReason)
							return
						}
						if (u.type === "error") {
							r.reject(new TypeError("fetch failed", { cause: u.error }))
							return
						}
						;(o = new WeakRef(IYe(u, "immutable"))), r.resolve(o.deref()), (r = null)
					}
				},
				dispatcher: n[eKe],
			})),
			r.promise
		)
	}
	function $se(e, t = "other") {
		if ((e.type === "error" && e.aborted) || !e.urlList?.length) return
		let r = e.urlList[0],
			n = e.timingInfo,
			i = e.cacheState
		PV(r) &&
			n !== null &&
			(e.timingAllowPassed || ((n = NV({ startTime: n.startTime })), (i = "")),
			(n.endTime = lb()),
			(e.timingInfo = n),
			Yse(n, r.href, t, globalThis, i))
	}
	var Yse = performance.markResourceTiming
	function MV(e, t, r, n) {
		if (
			(e && e.reject(n),
			t.body != null &&
				BD(t.body?.stream) &&
				t.body.stream.cancel(n).catch((s) => {
					if (s.code !== "ERR_INVALID_STATE") throw s
				}),
			r == null)
		)
			return
		let i = r[Hse]
		i.body != null &&
			BD(i.body?.stream) &&
			i.body.stream.cancel(n).catch((s) => {
				if (s.code !== "ERR_INVALID_STATE") throw s
			})
	}
	function Kse({
		request: e,
		processRequestBodyChunkLength: t,
		processRequestEndOfBody: r,
		processResponse: n,
		processResponseEndOfBody: i,
		processResponseConsumeBody: s,
		useParallelQueue: o = !1,
		dispatcher: a = hKe(),
	}) {
		yp(a)
		let l = null,
			c = !1
		e.client != null && ((l = e.client.globalObject), (c = e.client.crossOriginIsolatedCapability))
		let u = lb(c),
			f = NV({ startTime: u }),
			p = {
				controller: new DD(a),
				request: e,
				timingInfo: f,
				processRequestBodyChunkLength: t,
				processRequestEndOfBody: r,
				processResponse: n,
				processResponseConsumeBody: s,
				processResponseEndOfBody: i,
				taskDestination: l,
				crossOriginIsolatedCapability: c,
			}
		if (
			(yp(!e.body || e.body.stream),
			e.window === "client" &&
				(e.window = e.client?.globalObject?.constructor?.name === "Window" ? e.client : "no-window"),
			e.origin === "client" && (e.origin = e.client.origin),
			e.policyContainer === "client" &&
				(e.client != null ? (e.policyContainer = RYe(e.client.policyContainer)) : (e.policyContainer = TYe())),
			!e.headersList.contains("accept", !0))
		) {
			let g = "*/*"
			e.headersList.append("accept", g, !0)
		}
		return (
			e.headersList.contains("accept-language", !0) || e.headersList.append("accept-language", "*", !0),
			e.priority,
			nKe.has(e.destination),
			Jse(p).catch((g) => {
				p.controller.terminate(g)
			}),
			p.controller
		)
	}
	async function Jse(e, t = !1) {
		let r = e.request,
			n = null
		if (
			(r.localURLsOnly && !YYe(uu(r)) && (n = nn("local URLs only")),
			PYe(r),
			kYe(r) === "blocked" && (n = nn("bad port")),
			r.referrerPolicy === "" && (r.referrerPolicy = r.policyContainer.referrerPolicy),
			r.referrer !== "no-referrer" && (r.referrer = qYe(r)),
			n === null &&
				(n = await (async () => {
					let s = uu(r)
					return (QV(s, r.url) && r.responseTainting === "basic") ||
						s.protocol === "data:" ||
						r.mode === "navigate" ||
						r.mode === "websocket"
						? ((r.responseTainting = "basic"), await Vse(e))
						: r.mode === "same-origin"
							? nn('request mode cannot be "same-origin"')
							: r.mode === "no-cors"
								? r.redirect !== "follow"
									? nn('redirect mode cannot be "follow" for "no-cors" request')
									: ((r.responseTainting = "opaque"), await Vse(e))
								: PV(uu(r))
									? ((r.responseTainting = "cors"), await zse(e))
									: nn("URL scheme must be a HTTP(S) scheme")
				})()),
			t)
		)
			return n
		n.status !== 0 &&
			!n.internalResponse &&
			(r.responseTainting,
			r.responseTainting === "basic"
				? (n = RV(n, "basic"))
				: r.responseTainting === "cors"
					? (n = RV(n, "cors"))
					: r.responseTainting === "opaque"
						? (n = RV(n, "opaque"))
						: yp(!1))
		let i = n.status === 0 ? n : n.internalResponse
		if (
			(i.urlList.length === 0 && i.urlList.push(...r.urlList),
			r.timingAllowFailed || (n.timingAllowPassed = !0),
			n.type === "opaque" &&
				i.status === 206 &&
				i.rangeRequested &&
				!r.headers.contains("range", !0) &&
				(n = i = nn()),
			n.status !== 0 &&
				(r.method === "HEAD" || r.method === "CONNECT" || Gse.includes(i.status)) &&
				((i.body = null), (e.controller.dump = !0)),
			r.integrity)
		) {
			let s = (a) => FV(e, nn(a))
			if (r.responseTainting === "opaque" || n.body == null) {
				s(n.error)
				return
			}
			let o = (a) => {
				if (!DYe(a, r.integrity)) {
					s("integrity mismatch")
					return
				}
				;(n.body = LV(a)[0]), FV(e, n)
			}
			await GYe(n.body, o, s)
		} else FV(e, n)
	}
	function Vse(e) {
		if (mp(e) && e.request.redirectCount === 0) return Promise.resolve(wD(e))
		let { request: t } = e,
			{ protocol: r } = uu(t)
		switch (r) {
			case "about:":
				return Promise.resolve(nn("about scheme is not supported"))
			case "blob:": {
				kV || (kV = require("buffer").resolveObjectURL)
				let n = uu(t)
				if (n.search.length !== 0) return Promise.resolve(nn("NetworkError when attempting to fetch resource."))
				let i = kV(n.toString())
				if (t.method !== "GET" || !HYe(i)) return Promise.resolve(nn("invalid method"))
				let s = ID(),
					o = i.size,
					a = SD(`${o}`),
					l = i.type
				if (t.headersList.contains("range", !0)) {
					s.rangeRequested = !0
					let c = t.headersList.get("range", !0),
						u = zYe(c, !0)
					if (u === "failure") return Promise.resolve(nn("failed to fetch the data URL"))
					let { rangeStartValue: f, rangeEndValue: p } = u
					if (f === null) (f = o - p), (p = f + p - 1)
					else {
						if (f >= o) return Promise.resolve(nn("Range start is greater than the blob's size."))
						;(p === null || p >= o) && (p = o - 1)
					}
					let g = i.slice(f, p, l),
						m = Ose(g)
					s.body = m[0]
					let y = SD(`${g.size}`),
						C = jYe(f, p, o)
					;(s.status = 206),
						(s.statusText = "Partial Content"),
						s.headersList.set("content-length", y, !0),
						s.headersList.set("content-type", l, !0),
						s.headersList.set("content-range", C, !0)
				} else {
					let c = Ose(i)
					;(s.statusText = "OK"),
						(s.body = c[0]),
						s.headersList.set("content-length", a, !0),
						s.headersList.set("content-type", l, !0)
				}
				return Promise.resolve(s)
			}
			case "data:": {
				let n = uu(t),
					i = uKe(n)
				if (i === "failure") return Promise.resolve(nn("failed to fetch the data URL"))
				let s = dKe(i.mimeType)
				return Promise.resolve(
					ID({
						statusText: "OK",
						headersList: [["content-type", { name: "Content-Type", value: s }]],
						body: LV(i.body)[0],
					}),
				)
			}
			case "file:":
				return Promise.resolve(nn("not implemented... yet..."))
			case "http:":
			case "https:":
				return zse(e).catch((n) => nn(n))
			default:
				return Promise.resolve(nn("unknown scheme"))
		}
	}
	function vKe(e, t) {
		;(e.request.done = !0), e.processResponseDone != null && queueMicrotask(() => e.processResponseDone(t))
	}
	function FV(e, t) {
		let r = e.timingInfo,
			n = () => {
				let s = Date.now()
				e.request.destination === "document" && (e.controller.fullTimingInfo = r),
					(e.controller.reportTimingSteps = () => {
						if (e.request.url.protocol !== "https:") return
						r.endTime = s
						let a = t.cacheState,
							l = t.bodyInfo
						t.timingAllowPassed || ((r = NV(r)), (a = ""))
						let c = 0
						if (e.request.mode !== "navigator" || !t.hasCrossOriginRedirects) {
							c = t.status
							let u = XYe(t.headersList)
							u !== "failure" && (l.contentType = fKe(u))
						}
						e.request.initiatorType != null &&
							Yse(r, e.request.url.href, e.request.initiatorType, globalThis, a, l, c)
					})
				let o = () => {
					;(e.request.done = !0),
						e.processResponseEndOfBody != null && queueMicrotask(() => e.processResponseEndOfBody(t)),
						e.request.initiatorType != null && e.controller.reportTimingSteps()
				}
				queueMicrotask(() => o())
			}
		e.processResponse != null &&
			queueMicrotask(() => {
				e.processResponse(t), (e.processResponse = null)
			})
		let i = t.type === "error" ? t : (t.internalResponse ?? t)
		i.body == null
			? n()
			: aKe(i.body.stream, () => {
					n()
				})
	}
	async function zse(e) {
		let t = e.request,
			r = null,
			n = null,
			i = e.timingInfo
		if ((t.serviceWorkers, r === null)) {
			if (
				(t.redirect === "follow" && (t.serviceWorkers = "none"),
				(n = r = await jse(e)),
				t.responseTainting === "cors" && UYe(t, r) === "failure")
			)
				return nn("cors failure")
			MYe(t, r) === "failure" && (t.timingAllowFailed = !0)
		}
		return (t.responseTainting === "opaque" || r.type === "opaque") &&
			OYe(t.origin, t.client, t.destination, n) === "blocked"
			? nn("blocked")
			: (Wse.has(n.status) &&
					(t.redirect !== "manual" && e.controller.connection.destroy(void 0, !1),
					t.redirect === "error"
						? (r = nn("unexpected redirect"))
						: t.redirect === "manual"
							? (r = n)
							: t.redirect === "follow"
								? (r = await EKe(e, r))
								: yp(!1)),
				(r.timingInfo = i),
				r)
	}
	function EKe(e, t) {
		let r = e.request,
			n = t.internalResponse ? t.internalResponse : t,
			i
		try {
			if (((i = QYe(n, uu(r).hash)), i == null)) return t
		} catch (o) {
			return Promise.resolve(nn(o))
		}
		if (!PV(i)) return Promise.resolve(nn("URL scheme must be a HTTP(S) scheme"))
		if (r.redirectCount === 20) return Promise.resolve(nn("redirect count exceeded"))
		if (((r.redirectCount += 1), r.mode === "cors" && (i.username || i.password) && !QV(r, i)))
			return Promise.resolve(nn('cross origin not allowed for request mode "cors"'))
		if (r.responseTainting === "cors" && (i.username || i.password))
			return Promise.resolve(nn('URL cannot contain credentials for request mode "cors"'))
		if (n.status !== 303 && r.body != null && r.body.source == null) return Promise.resolve(nn())
		if (([301, 302].includes(n.status) && r.method === "POST") || (n.status === 303 && !AKe.includes(r.method))) {
			;(r.method = "GET"), (r.body = null)
			for (let o of rKe) r.headersList.delete(o)
		}
		QV(uu(r), i) ||
			(r.headersList.delete("authorization", !0),
			r.headersList.delete("proxy-authorization", !0),
			r.headersList.delete("cookie", !0),
			r.headersList.delete("host", !0)),
			r.body != null && (yp(r.body.source != null), (r.body = LV(r.body.source)[0]))
		let s = e.timingInfo
		return (
			(s.redirectEndTime = s.postRedirectStartTime = lb(e.crossOriginIsolatedCapability)),
			s.redirectStartTime === 0 && (s.redirectStartTime = s.startTime),
			r.urlList.push(i),
			NYe(r, n),
			Jse(e, !0)
		)
	}
	async function jse(e, t = !1, r = !1) {
		let n = e.request,
			i = null,
			s = null,
			o = null,
			a = null,
			l = !1
		n.window === "no-window" && n.redirect === "error"
			? ((i = e), (s = n))
			: ((s = BYe(n)), (i = { ...e }), (i.request = s))
		let c = n.credentials === "include" || (n.credentials === "same-origin" && n.responseTainting === "basic"),
			u = s.body ? s.body.length : null,
			f = null
		if (
			(s.body == null && ["POST", "PUT"].includes(s.method) && (f = "0"),
			u != null && (f = SD(`${u}`)),
			f != null && s.headersList.append("content-length", f, !0),
			u != null && s.keepalive,
			s.referrer instanceof URL && s.headersList.append("referer", SD(s.referrer.href), !0),
			FYe(s),
			LYe(s),
			s.headersList.contains("user-agent", !0) || s.headersList.append("user-agent", mKe),
			s.cache === "default" &&
				(s.headersList.contains("if-modified-since", !0) ||
					s.headersList.contains("if-none-match", !0) ||
					s.headersList.contains("if-unmodified-since", !0) ||
					s.headersList.contains("if-match", !0) ||
					s.headersList.contains("if-range", !0)) &&
				(s.cache = "no-store"),
			s.cache === "no-cache" &&
				!s.preventNoCacheCacheControlHeaderModification &&
				!s.headersList.contains("cache-control", !0) &&
				s.headersList.append("cache-control", "max-age=0", !0),
			(s.cache === "no-store" || s.cache === "reload") &&
				(s.headersList.contains("pragma", !0) || s.headersList.append("pragma", "no-cache", !0),
				s.headersList.contains("cache-control", !0) || s.headersList.append("cache-control", "no-cache", !0)),
			s.headersList.contains("range", !0) && s.headersList.append("accept-encoding", "identity", !0),
			s.headersList.contains("accept-encoding", !0) ||
				(KYe(uu(s))
					? s.headersList.append("accept-encoding", "br, gzip, deflate", !0)
					: s.headersList.append("accept-encoding", "gzip, deflate", !0)),
			s.headersList.delete("host", !0),
			a == null && (s.cache = "no-store"),
			s.cache !== "no-store" && s.cache,
			o == null)
		) {
			if (s.cache === "only-if-cached") return nn("only if cached")
			let p = await bKe(i, c, r)
			!tKe.has(s.method) && p.status >= 200 && p.status <= 399, l && p.status, o == null && (o = p)
		}
		if (
			((o.urlList = [...s.urlList]),
			s.headersList.contains("range", !0) && (o.rangeRequested = !0),
			(o.requestIncludesCredentials = c),
			o.status === 407)
		)
			return n.window === "no-window" ? nn() : mp(e) ? wD(e) : nn("proxy authentication required")
		if (o.status === 421 && !r && (n.body == null || n.body.source != null)) {
			if (mp(e)) return wD(e)
			e.controller.connection.destroy(), (o = await jse(e, t, !0))
		}
		return o
	}
	async function bKe(e, t = !1, r = !1) {
		yp(!e.controller.connection || e.controller.connection.destroyed),
			(e.controller.connection = {
				abort: null,
				destroyed: !1,
				destroy(m, y = !0) {
					this.destroyed ||
						((this.destroyed = !0),
						y && this.abort?.(m ?? new DOMException("The operation was aborted.", "AbortError")))
				},
			})
		let n = e.request,
			i = null,
			s = e.timingInfo
		null == null && (n.cache = "no-store")
		let a = r ? "yes" : "no"
		n.mode
		let l = null
		if (n.body == null && e.processRequestEndOfBody) queueMicrotask(() => e.processRequestEndOfBody())
		else if (n.body != null) {
			let m = async function* (v) {
					mp(e) || (yield v, e.processRequestBodyChunkLength?.(v.byteLength))
				},
				y = () => {
					mp(e) || (e.processRequestEndOfBody && e.processRequestEndOfBody())
				},
				C = (v) => {
					mp(e) || (v.name === "AbortError" ? e.controller.abort() : e.controller.terminate(v))
				}
			l = (async function* () {
				try {
					for await (let v of n.body.stream) yield* m(v)
					y()
				} catch (v) {
					C(v)
				}
			})()
		}
		try {
			let { body: m, status: y, statusText: C, headersList: v, socket: b } = await g({ body: l })
			if (b) i = ID({ status: y, statusText: C, headersList: v, socket: b })
			else {
				let w = m[Symbol.asyncIterator]()
				;(e.controller.next = () => w.next()), (i = ID({ status: y, statusText: C, headersList: v }))
			}
		} catch (m) {
			return m.name === "AbortError" ? (e.controller.connection.destroy(), wD(e, m)) : nn(m)
		}
		let c = async () => {
				await e.controller.resume()
			},
			u = (m) => {
				mp(e) || e.controller.abort(m)
			},
			f = new ReadableStream({
				async start(m) {
					e.controller.controller = m
				},
				async pull(m) {
					await c(m)
				},
				async cancel(m) {
					await u(m)
				},
				type: "bytes",
			})
		;(i.body = { stream: f, source: null, length: null }),
			(e.controller.onAborted = p),
			e.controller.on("terminated", p),
			(e.controller.resume = async () => {
				for (;;) {
					let m, y
					try {
						let { done: v, value: b } = await e.controller.next()
						if (Use(e)) break
						m = v ? void 0 : b
					} catch (v) {
						e.controller.ended && !s.encodedBodySize ? (m = void 0) : ((m = v), (y = !0))
					}
					if (m === void 0) {
						$Ye(e.controller.controller), vKe(e, i)
						return
					}
					if (((s.decodedBodySize += m?.byteLength ?? 0), y)) {
						e.controller.terminate(m)
						return
					}
					let C = new Uint8Array(m)
					if ((C.byteLength && e.controller.controller.enqueue(C), cKe(f))) {
						e.controller.terminate()
						return
					}
					if (e.controller.controller.desiredSize <= 0) return
				}
			})
		function p(m) {
			Use(e)
				? ((i.aborted = !0), BD(f) && e.controller.controller.error(e.controller.serializedAbortReason))
				: BD(f) && e.controller.controller.error(new TypeError("terminated", { cause: WYe(m) ? m : void 0 })),
				e.controller.connection.destroy()
		}
		return i
		function g({ body: m }) {
			let y = uu(n),
				C = e.controller.dispatcher
			return new Promise((v, b) =>
				C.dispatch(
					{
						path: y.pathname + y.search,
						origin: y.origin,
						method: n.method,
						body: C.isMockActive ? n.body && (n.body.source || n.body.stream) : m,
						headers: n.headersList.entries,
						maxRedirections: 0,
						upgrade: n.mode === "websocket" ? "websocket" : void 0,
					},
					{
						body: null,
						abort: null,
						onConnect(w) {
							let { connection: B } = e.controller
							;(s.finalConnectionTimingInfo = JYe(
								void 0,
								s.postRedirectStartTime,
								e.crossOriginIsolatedCapability,
							)),
								B.destroyed
									? w(new DOMException("The operation was aborted.", "AbortError"))
									: (e.controller.on("terminated", w), (this.abort = B.abort = w)),
								(s.finalNetworkRequestStartTime = lb(e.crossOriginIsolatedCapability))
						},
						onResponseStarted() {
							s.finalNetworkResponseStartTime = lb(e.crossOriginIsolatedCapability)
						},
						onHeaders(w, B, M, Q) {
							if (w < 200) return
							let O = [],
								Y = "",
								j = new Lse()
							for (let N = 0; N < B.length; N += 2) j.append(qse(B[N]), B[N + 1].toString("latin1"), !0)
							let ne = j.get("content-encoding", !0)
							ne &&
								(O = ne
									.toLowerCase()
									.split(",")
									.map((N) => N.trim())),
								(Y = j.get("location", !0)),
								(this.body = new sKe({ read: M }))
							let q = [],
								me = Y && n.redirect === "follow" && Wse.has(w)
							if (
								O.length !== 0 &&
								n.method !== "HEAD" &&
								n.method !== "CONNECT" &&
								!Gse.includes(w) &&
								!me
							)
								for (let N = O.length - 1; N >= 0; --N) {
									let re = O[N]
									if (re === "x-gzip" || re === "gzip")
										q.push(
											nh.createGunzip({
												flush: nh.constants.Z_SYNC_FLUSH,
												finishFlush: nh.constants.Z_SYNC_FLUSH,
											}),
										)
									else if (re === "deflate")
										q.push(
											ZYe({
												flush: nh.constants.Z_SYNC_FLUSH,
												finishFlush: nh.constants.Z_SYNC_FLUSH,
											}),
										)
									else if (re === "br")
										q.push(
											nh.createBrotliDecompress({
												flush: nh.constants.BROTLI_OPERATION_FLUSH,
												finishFlush: nh.constants.BROTLI_OPERATION_FLUSH,
											}),
										)
									else {
										q.length = 0
										break
									}
								}
							let Qe = this.onError.bind(this)
							return (
								v({
									status: w,
									statusText: Q,
									headersList: j,
									body: q.length
										? oKe(this.body, ...q, (N) => {
												N && this.onError(N)
											}).on("error", Qe)
										: this.body.on("error", Qe),
								}),
								!0
							)
						},
						onData(w) {
							if (e.controller.dump) return
							let B = w
							return (s.encodedBodySize += B.byteLength), this.body.push(B)
						},
						onComplete() {
							this.abort && e.controller.off("terminated", this.abort),
								e.controller.onAborted && e.controller.off("terminated", e.controller.onAborted),
								(e.controller.ended = !0),
								this.body.push(null)
						},
						onError(w) {
							this.abort && e.controller.off("terminated", this.abort),
								this.body?.destroy(w),
								e.controller.terminate(w),
								b(w)
						},
						onUpgrade(w, B, M) {
							if (w !== 101) return
							let Q = new Lse()
							for (let O = 0; O < B.length; O += 2) Q.append(qse(B[O]), B[O + 1].toString("latin1"), !0)
							return v({ status: w, statusText: pKe[w], headersList: Q, socket: M }), !0
						},
					},
				),
			)
		}
	}
	Zse.exports = {
		fetch: CKe,
		Fetch: DD,
		fetching: Kse,
		finalizeAndReportTiming: $se,
	}
})