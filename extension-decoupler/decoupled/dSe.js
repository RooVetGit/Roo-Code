
	var {
			Headers: gse,
			HeadersList: cse,
			fill: P$e,
			getHeadersGuard: L$e,
			setHeadersGuard: pse,
			setHeadersList: Ase,
		} = pp(),
		{
			extractBody: use,
			cloneBody: U$e,
			mixinBody: O$e,
			hasFinalizationRegistry: q$e,
			streamRegistry: V$e,
			bodyUnusable: H$e,
		} = s0(),
		_V = Xt(),
		dse = require("util"),
		{ kEnumerableProperty: ya } = _V,
		{
			isValidReasonPhrase: W$e,
			isCancelled: G$e,
			isAborted: $$e,
			isBlobLike: Y$e,
			serializeJavascriptValueToJSONString: K$e,
			isErrorLike: J$e,
			isomorphicEncode: z$e,
			environmentSettingsObject: j$e,
		} = ga(),
		{ redirectStatusSet: Z$e, nullBodyStatus: X$e } = SE(),
		{ kState: ni, kHeaders: Md } = Gf(),
		{ webidl: Ht } = ys(),
		{ FormData: eYe } = ME(),
		{ URLSerializer: fse } = No(),
		{ kConstruct: AD } = Qn(),
		wV = require("assert"),
		{ types: tYe } = require("util"),
		rYe = new TextEncoder("utf-8"),
		Ap = class e {
			static error() {
				return ob(mD(), "immutable")
			}
			static json(t, r = {}) {
				Ht.argumentLengthCheck(arguments, 1, "Response.json"), r !== null && (r = Ht.converters.ResponseInit(r))
				let n = rYe.encode(K$e(t)),
					i = use(n),
					s = ob(_0({}), "response")
				return hse(s, r, { body: i[0], type: "application/json" }), s
			}
			static redirect(t, r = 302) {
				Ht.argumentLengthCheck(arguments, 1, "Response.redirect"),
					(t = Ht.converters.USVString(t)),
					(r = Ht.converters["unsigned short"](r))
				let n
				try {
					n = new URL(t, j$e.settingsObject.baseUrl)
				} catch (o) {
					throw new TypeError(`Failed to parse URL from ${t}`, { cause: o })
				}
				if (!Z$e.has(r)) throw new RangeError(`Invalid status code ${r}`)
				let i = ob(_0({}), "immutable")
				i[ni].status = r
				let s = z$e(fse(n))
				return i[ni].headersList.append("location", s, !0), i
			}
			constructor(t = null, r = {}) {
				if ((Ht.util.markAsUncloneable(this), t === AD)) return
				t !== null && (t = Ht.converters.BodyInit(t)),
					(r = Ht.converters.ResponseInit(r)),
					(this[ni] = _0({})),
					(this[Md] = new gse(AD)),
					pse(this[Md], "response"),
					Ase(this[Md], this[ni].headersList)
				let n = null
				if (t != null) {
					let [i, s] = use(t)
					n = { body: i, type: s }
				}
				hse(this, r, n)
			}
			get type() {
				return Ht.brandCheck(this, e), this[ni].type
			}
			get url() {
				Ht.brandCheck(this, e)
				let t = this[ni].urlList,
					r = t[t.length - 1] ?? null
				return r === null ? "" : fse(r, !0)
			}
			get redirected() {
				return Ht.brandCheck(this, e), this[ni].urlList.length > 1
			}
			get status() {
				return Ht.brandCheck(this, e), this[ni].status
			}
			get ok() {
				return Ht.brandCheck(this, e), this[ni].status >= 200 && this[ni].status <= 299
			}
			get statusText() {
				return Ht.brandCheck(this, e), this[ni].statusText
			}
			get headers() {
				return Ht.brandCheck(this, e), this[Md]
			}
			get body() {
				return Ht.brandCheck(this, e), this[ni].body ? this[ni].body.stream : null
			}
			get bodyUsed() {
				return Ht.brandCheck(this, e), !!this[ni].body && _V.isDisturbed(this[ni].body.stream)
			}
			clone() {
				if ((Ht.brandCheck(this, e), H$e(this)))
					throw Ht.errors.exception({
						header: "Response.clone",
						message: "Body has already been consumed.",
					})
				let t = IV(this[ni])
				return ob(t, L$e(this[Md]))
			}
			[dse.inspect.custom](t, r) {
				r.depth === null && (r.depth = 2), (r.colors ??= !0)
				let n = {
					status: this.status,
					statusText: this.statusText,
					headers: this.headers,
					body: this.body,
					bodyUsed: this.bodyUsed,
					ok: this.ok,
					redirected: this.redirected,
					type: this.type,
					url: this.url,
				}
				return `Response ${dse.formatWithOptions(r, n)}`
			}
		}