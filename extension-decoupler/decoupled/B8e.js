
	var uq = class extends r8e {
			constructor(
				t,
				{
					interceptors: r,
					maxHeaderSize: n,
					headersTimeout: i,
					socketTimeout: s,
					requestTimeout: o,
					connectTimeout: a,
					bodyTimeout: l,
					idleTimeout: c,
					keepAlive: u,
					keepAliveTimeout: f,
					maxKeepAliveTimeout: p,
					keepAliveMaxTimeout: g,
					keepAliveTimeoutThreshold: m,
					socketPath: y,
					pipelining: C,
					tls: v,
					strictContentLength: b,
					maxCachedSessions: w,
					maxRedirections: B,
					connect: M,
					maxRequestsPerClient: Q,
					localAddress: O,
					maxResponseSize: Y,
					autoSelectFamily: j,
					autoSelectFamilyAttemptTimeout: ne,
					maxConcurrentStreams: q,
					allowH2: me,
				} = {},
			) {
				if ((super(), u !== void 0)) throw new pi("unsupported keepAlive, use pipelining=0 instead")
				if (s !== void 0) throw new pi("unsupported socketTimeout, use headersTimeout & bodyTimeout instead")
				if (o !== void 0) throw new pi("unsupported requestTimeout, use headersTimeout & bodyTimeout instead")
				if (c !== void 0) throw new pi("unsupported idleTimeout, use keepAliveTimeout instead")
				if (p !== void 0) throw new pi("unsupported maxKeepAliveTimeout, use keepAliveMaxTimeout instead")
				if (n != null && !Number.isFinite(n)) throw new pi("invalid maxHeaderSize")
				if (y != null && typeof y != "string") throw new pi("invalid socketPath")
				if (a != null && (!Number.isFinite(a) || a < 0)) throw new pi("invalid connectTimeout")
				if (f != null && (!Number.isFinite(f) || f <= 0)) throw new pi("invalid keepAliveTimeout")
				if (g != null && (!Number.isFinite(g) || g <= 0)) throw new pi("invalid keepAliveMaxTimeout")
				if (m != null && !Number.isFinite(m)) throw new pi("invalid keepAliveTimeoutThreshold")
				if (i != null && (!Number.isInteger(i) || i < 0))
					throw new pi("headersTimeout must be a positive integer or zero")
				if (l != null && (!Number.isInteger(l) || l < 0))
					throw new pi("bodyTimeout must be a positive integer or zero")
				if (M != null && typeof M != "function" && typeof M != "object")
					throw new pi("connect must be a function or an object")
				if (B != null && (!Number.isInteger(B) || B < 0))
					throw new pi("maxRedirections must be a positive number")
				if (Q != null && (!Number.isInteger(Q) || Q < 0))
					throw new pi("maxRequestsPerClient must be a positive number")
				if (O != null && (typeof O != "string" || _re.isIP(O) === 0))
					throw new pi("localAddress must be valid string IP address")
				if (Y != null && (!Number.isInteger(Y) || Y < -1))
					throw new pi("maxResponseSize must be a positive number")
				if (ne != null && (!Number.isInteger(ne) || ne < -1))
					throw new pi("autoSelectFamilyAttemptTimeout must be a positive number")
				if (me != null && typeof me != "boolean") throw new pi("allowH2 must be a valid boolean value")
				if (q != null && (typeof q != "number" || q < 1))
					throw new pi("maxConcurrentStreams must be a positive integer, greater than 0")
				typeof M != "function" &&
					(M = s8e({
						...v,
						maxCachedSessions: w,
						allowH2: me,
						socketPath: y,
						timeout: a,
						...(j ? { autoSelectFamily: j, autoSelectFamilyAttemptTimeout: ne } : void 0),
						...M,
					})),
					r?.Client && Array.isArray(r.Client)
						? ((this[vre] = r.Client),
							Ere ||
								((Ere = !0),
								process.emitWarning(
									"Client.Options#interceptor is deprecated. Use Dispatcher#compose instead.",
									{ code: "UNDICI-CLIENT-INTERCEPTOR-DEPRECATED" },
								)))
						: (this[vre] = [B8e({ maxRedirections: B })]),
					(this[au] = op.parseOrigin(t)),
					(this[OE] = M),
					(this[$B] = C ?? 1),
					(this[f8e] = n || e8e.maxHeaderSize),
					(this[Cre] = f ?? 4e3),
					(this[h8e] = g ?? 6e5),
					(this[g8e] = m ?? 2e3),
					(this[d8e] = this[Cre]),
					(this[zf] = null),
					(this[qE] = O ?? null),
					(this[ap] = 0),
					(this[Zf] = 0),
					(this[c8e] = `host: ${this[au].hostname}${this[au].port ? `:${this[au].port}` : ""}\r
`),
					(this[A8e] = l ?? 3e5),
					(this[p8e] = i ?? 3e5),
					(this[m8e] = b ?? !0),
					(this[y8e] = B),
					(this[cq] = Q),
					(this[jf] = null),
					(this[x8e] = Y > -1 ? Y : -1),
					(this[w8e] = q ?? 100),
					(this[Ai] = null),
					(this[ac] = []),
					(this[Rd] = 0),
					(this[lc] = 0),
					(this[VE] = (Qe) => dq(this, Qe)),
					(this[_8e] = (Qe) => Ire(this, Qe))
			}
			get pipelining() {
				return this[$B]
			}
			set pipelining(t) {
				;(this[$B] = t), this[VE](!0)
			}
			get [GE]() {
				return this[ac].length - this[lc]
			}
			get [WE]() {
				return this[lc] - this[Rd]
			}
			get [HE]() {
				return this[ac].length - this[Rd]
			}
			get [l8e]() {
				return !!this[Ai] && !this[d0] && !this[Ai].destroyed
			}
			get [lq]() {
				return !!(this[Ai]?.busy(null) || this[HE] >= (wre(this) || 1) || this[GE] > 0)
			}
			[a8e](t) {
				Sre(this), this.once("connect", t)
			}
			[b8e](t, r) {
				let n = t.origin || this[au].origin,
					i = new t8e(n, t, r)
				return (
					this[ac].push(i),
					this[ap] ||
						(op.bodyLength(i.body) == null && op.isIterable(i.body)
							? ((this[ap] = 1), queueMicrotask(() => dq(this)))
							: this[VE](!0)),
					this[ap] && this[Zf] !== 2 && this[lq] && (this[Zf] = 2),
					this[Zf] < 2
				)
			}
			async [v8e]() {
				return new Promise((t) => {
					this[HE] ? (this[jf] = t) : t(null)
				})
			}
			async [E8e](t) {
				return new Promise((r) => {
					let n = this[ac].splice(this[lc])
					for (let s = 0; s < n.length; s++) {
						let o = n[s]
						op.errorRequest(this, o, t)
					}
					let i = () => {
						this[jf] && (this[jf](), (this[jf] = null)), r(null)
					}
					this[Ai] ? (this[Ai].destroy(t, i), (this[Ai] = null)) : queueMicrotask(i), this[VE]()
				})
			}
		},
		B8e = GB()