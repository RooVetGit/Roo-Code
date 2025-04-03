
	var ou = Xt(),
		{ kBodyUsed: UE } = Qn(),
		aq = require("assert"),
		{ InvalidArgumentError: YGe } = Vr(),
		KGe = require("events"),
		JGe = [300, 301, 302, 303, 307, 308],
		pre = Symbol("body"),
		HB = class {
			constructor(t) {
				;(this[pre] = t), (this[UE] = !1)
			}
			async *[Symbol.asyncIterator]() {
				aq(!this[UE], "disturbed"), (this[UE] = !0), yield* this[pre]
			}
		},
		oq = class {
			constructor(t, r, n, i) {
				if (r != null && (!Number.isInteger(r) || r < 0))
					throw new YGe("maxRedirections must be a positive number")
				ou.validateHandler(i, n.method, n.upgrade),
					(this.dispatch = t),
					(this.location = null),
					(this.abort = null),
					(this.opts = { ...n, maxRedirections: 0 }),
					(this.maxRedirections = r),
					(this.handler = i),
					(this.history = []),
					(this.redirectionLimitReached = !1),
					ou.isStream(this.opts.body)
						? (ou.bodyLength(this.opts.body) === 0 &&
								this.opts.body.on("data", function () {
									aq(!1)
								}),
							typeof this.opts.body.readableDidRead != "boolean" &&
								((this.opts.body[UE] = !1),
								KGe.prototype.on.call(this.opts.body, "data", function () {
									this[UE] = !0
								})))
						: this.opts.body && typeof this.opts.body.pipeTo == "function"
							? (this.opts.body = new HB(this.opts.body))
							: this.opts.body &&
								typeof this.opts.body != "string" &&
								!ArrayBuffer.isView(this.opts.body) &&
								ou.isIterable(this.opts.body) &&
								(this.opts.body = new HB(this.opts.body))
			}
			onConnect(t) {
				;(this.abort = t), this.handler.onConnect(t, { history: this.history })
			}
			onUpgrade(t, r, n) {
				this.handler.onUpgrade(t, r, n)
			}
			onError(t) {
				this.handler.onError(t)
			}
			onHeaders(t, r, n, i) {
				if (
					((this.location =
						this.history.length >= this.maxRedirections || ou.isDisturbed(this.opts.body)
							? null
							: zGe(t, r)),
					this.opts.throwOnMaxRedirect && this.history.length >= this.maxRedirections)
				) {
					this.request && this.request.abort(new Error("max redirects")),
						(this.redirectionLimitReached = !0),
						this.abort(new Error("max redirects"))
					return
				}
				if ((this.opts.origin && this.history.push(new URL(this.opts.path, this.opts.origin)), !this.location))
					return this.handler.onHeaders(t, r, n, i)
				let {
						origin: s,
						pathname: o,
						search: a,
					} = ou.parseURL(
						new URL(this.location, this.opts.origin && new URL(this.opts.path, this.opts.origin)),
					),
					l = a ? `${o}${a}` : o
				;(this.opts.headers = jGe(this.opts.headers, t === 303, this.opts.origin !== s)),
					(this.opts.path = l),
					(this.opts.origin = s),
					(this.opts.maxRedirections = 0),
					(this.opts.query = null),
					t === 303 && this.opts.method !== "HEAD" && ((this.opts.method = "GET"), (this.opts.body = null))
			}
			onData(t) {
				if (!this.location) return this.handler.onData(t)
			}
			onComplete(t) {
				this.location
					? ((this.location = null), (this.abort = null), this.dispatch(this.opts, this))
					: this.handler.onComplete(t)
			}
			onBodySent(t) {
				this.handler.onBodySent && this.handler.onBodySent(t)
			}
		}