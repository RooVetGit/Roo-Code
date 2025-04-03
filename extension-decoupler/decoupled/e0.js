
	var { getResponseData: H9e, buildKey: W9e, addMockDispatch: rV } = ib(),
		{
			kDispatches: iD,
			kDispatchKey: sD,
			kDefaultHeaders: nV,
			kDefaultTrailers: iV,
			kContentLength: sV,
			kMockDispatch: oD,
		} = v0(),
		{ InvalidArgumentError: cu } = Vr(),
		{ buildURL: G9e } = Xt(),
		E0 = class {
			constructor(t) {
				this[oD] = t
			}
			delay(t) {
				if (typeof t != "number" || !Number.isInteger(t) || t <= 0)
					throw new cu("waitInMs must be a valid integer > 0")
				return (this[oD].delay = t), this
			}
			persist() {
				return (this[oD].persist = !0), this
			}
			times(t) {
				if (typeof t != "number" || !Number.isInteger(t) || t <= 0)
					throw new cu("repeatTimes must be a valid integer > 0")
				return (this[oD].times = t), this
			}
		},
		oV = class {
			constructor(t, r) {
				if (typeof t != "object") throw new cu("opts must be an object")
				if (typeof t.path > "u") throw new cu("opts.path must be defined")
				if ((typeof t.method > "u" && (t.method = "GET"), typeof t.path == "string"))
					if (t.query) t.path = G9e(t.path, t.query)
					else {
						let n = new URL(t.path, "data://")
						t.path = n.pathname + n.search
					}
				typeof t.method == "string" && (t.method = t.method.toUpperCase()),
					(this[sD] = W9e(t)),
					(this[iD] = r),
					(this[nV] = {}),
					(this[iV] = {}),
					(this[sV] = !1)
			}
			createMockScopeDispatchData({ statusCode: t, data: r, responseOptions: n }) {
				let i = H9e(r),
					s = this[sV] ? { "content-length": i.length } : {},
					o = { ...this[nV], ...s, ...n.headers },
					a = { ...this[iV], ...n.trailers }
				return { statusCode: t, data: r, headers: o, trailers: a }
			}
			validateReplyParameters(t) {
				if (typeof t.statusCode > "u") throw new cu("statusCode must be defined")
				if (typeof t.responseOptions != "object" || t.responseOptions === null)
					throw new cu("responseOptions must be an object")
			}
			reply(t) {
				if (typeof t == "function") {
					let s = (a) => {
							let l = t(a)
							if (typeof l != "object" || l === null)
								throw new cu("reply options callback must return an object")
							let c = { data: "", responseOptions: {}, ...l }
							return this.validateReplyParameters(c), { ...this.createMockScopeDispatchData(c) }
						},
						o = rV(this[iD], this[sD], s)
					return new E0(o)
				}
				let r = {
					statusCode: t,
					data: arguments[1] === void 0 ? "" : arguments[1],
					responseOptions: arguments[2] === void 0 ? {} : arguments[2],
				}
				this.validateReplyParameters(r)
				let n = this.createMockScopeDispatchData(r),
					i = rV(this[iD], this[sD], n)
				return new E0(i)
			}
			replyWithError(t) {
				if (typeof t > "u") throw new cu("error must be defined")
				let r = rV(this[iD], this[sD], { error: t })
				return new E0(r)
			}
			defaultReplyHeaders(t) {
				if (typeof t > "u") throw new cu("headers must be defined")
				return (this[nV] = t), this
			}
			defaultReplyTrailers(t) {
				if (typeof t > "u") throw new cu("trailers must be defined")
				return (this[iV] = t), this
			}
			replyContentLength() {
				return (this[sV] = !0), this
			}
		}