
	var { kClients: hp } = Qn(),
		u$e = h0(),
		{
			kAgent: pV,
			kMockAgentSet: aD,
			kMockAgentGet: Lie,
			kDispatches: AV,
			kIsMockActive: lD,
			kNetConnect: gp,
			kGetNetConnect: d$e,
			kOptions: cD,
			kFactory: uD,
		} = v0(),
		f$e = dV(),
		h$e = gV(),
		{ matchValue: g$e, buildMockOptions: p$e } = ib(),
		{ InvalidArgumentError: Uie, UndiciError: A$e } = Vr(),
		m$e = _E(),
		y$e = Qie(),
		C$e = Pie(),
		mV = class extends m$e {
			constructor(t) {
				if ((super(t), (this[gp] = !0), (this[lD] = !0), t?.agent && typeof t.agent.dispatch != "function"))
					throw new Uie("Argument opts.agent must implement Agent")
				let r = t?.agent ? t.agent : new u$e(t)
				;(this[pV] = r), (this[hp] = r[hp]), (this[cD] = p$e(t))
			}
			get(t) {
				let r = this[Lie](t)
				return r || ((r = this[uD](t)), this[aD](t, r)), r
			}
			dispatch(t, r) {
				return this.get(t.origin), this[pV].dispatch(t, r)
			}
			async close() {
				await this[pV].close(), this[hp].clear()
			}
			deactivate() {
				this[lD] = !1
			}
			activate() {
				this[lD] = !0
			}
			enableNetConnect(t) {
				if (typeof t == "string" || typeof t == "function" || t instanceof RegExp)
					Array.isArray(this[gp]) ? this[gp].push(t) : (this[gp] = [t])
				else if (typeof t > "u") this[gp] = !0
				else throw new Uie("Unsupported matcher. Must be one of String|Function|RegExp.")
			}
			disableNetConnect() {
				this[gp] = !1
			}
			get isMockActive() {
				return this[lD]
			}
			[aD](t, r) {
				this[hp].set(t, r)
			}
			[uD](t) {
				let r = Object.assign({ agent: this }, this[cD])
				return this[cD] && this[cD].connections === 1 ? new f$e(t, r) : new h$e(t, r)
			}
			[Lie](t) {
				let r = this[hp].get(t)
				if (r) return r
				if (typeof t != "string") {
					let n = this[uD]("http://localhost:9999")
					return this[aD](t, n), n
				}
				for (let [n, i] of Array.from(this[hp]))
					if (i && typeof n != "string" && g$e(n, t)) {
						let s = this[uD](t)
						return this[aD](t, s), (s[AV] = i[AV]), s
					}
			}
			[d$e]() {
				return this[gp]
			}
			pendingInterceptors() {
				let t = this[hp]
				return Array.from(t.entries())
					.flatMap(([r, n]) => n[AV].map((i) => ({ ...i, origin: r })))
					.filter(({ pending: r }) => r)
			}
			assertNoPendingInterceptors({ pendingInterceptorsFormatter: t = new C$e() } = {}) {
				let r = this.pendingInterceptors()
				if (r.length === 0) return
				let n = new y$e("interceptor", "interceptors").pluralize(r.length)
				throw new A$e(
					`
${n.count} ${n.noun} ${n.is} pending:

${t.format(r)}
`.trim(),
				)
			}
		}