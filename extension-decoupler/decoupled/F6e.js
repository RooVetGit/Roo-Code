
	var F6e = zm(),
		{
			kClose: Q6e,
			kDestroy: N6e,
			kClosed: cne,
			kDestroyed: une,
			kDispatch: P6e,
			kNoProxyAgent: ZE,
			kHttpProxyAgent: eh,
			kHttpsProxyAgent: dp,
		} = Qn(),
		dne = Tq(),
		L6e = h0(),
		U6e = { "http:": 80, "https:": 443 },
		fne = !1,
		Rq = class extends F6e {
			#e = null
			#t = null
			#i = null
			constructor(t = {}) {
				super(),
					(this.#i = t),
					fne ||
						((fne = !0),
						process.emitWarning("EnvHttpProxyAgent is experimental, expect them to change at any time.", {
							code: "UNDICI-EHPA",
						}))
				let { httpProxy: r, httpsProxy: n, noProxy: i, ...s } = t
				this[ZE] = new L6e(s)
				let o = r ?? process.env.http_proxy ?? process.env.HTTP_PROXY
				o ? (this[eh] = new dne({ ...s, uri: o })) : (this[eh] = this[ZE])
				let a = n ?? process.env.https_proxy ?? process.env.HTTPS_PROXY
				a ? (this[dp] = new dne({ ...s, uri: a })) : (this[dp] = this[eh]), this.#l()
			}
			[P6e](t, r) {
				let n = new URL(t.origin)
				return this.#n(n).dispatch(t, r)
			}
			async [Q6e]() {
				await this[ZE].close(),
					this[eh][cne] || (await this[eh].close()),
					this[dp][cne] || (await this[dp].close())
			}
			async [N6e](t) {
				await this[ZE].destroy(t),
					this[eh][une] || (await this[eh].destroy(t)),
					this[dp][une] || (await this[dp].destroy(t))
			}
			#n(t) {
				let { protocol: r, host: n, port: i } = t
				return (
					(n = n.replace(/:\d*$/, "").toLowerCase()),
					(i = Number.parseInt(i, 10) || U6e[r] || 0),
					this.#r(n, i) ? (r === "https:" ? this[dp] : this[eh]) : this[ZE]
				)
			}
			#r(t, r) {
				if ((this.#o && this.#l(), this.#t.length === 0)) return !0
				if (this.#e === "*") return !1
				for (let n = 0; n < this.#t.length; n++) {
					let i = this.#t[n]
					if (!(i.port && i.port !== r)) {
						if (/^[.*]/.test(i.hostname)) {
							if (t.endsWith(i.hostname.replace(/^\*/, ""))) return !1
						} else if (t === i.hostname) return !1
					}
				}
				return !0
			}
			#l() {
				let t = this.#i.noProxy ?? this.#u,
					r = t.split(/[,\s]/),
					n = []
				for (let i = 0; i < r.length; i++) {
					let s = r[i]
					if (!s) continue
					let o = s.match(/^(.+):(\d+)$/)
					n.push({
						hostname: (o ? o[1] : s).toLowerCase(),
						port: o ? Number.parseInt(o[2], 10) : 0,
					})
				}
				;(this.#e = t), (this.#t = n)
			}
			get #o() {
				return this.#i.noProxy !== void 0 ? !1 : this.#e !== this.#u
			}
			get #u() {
				return process.env.no_proxy ?? process.env.NO_PROXY ?? ""
			}
		}