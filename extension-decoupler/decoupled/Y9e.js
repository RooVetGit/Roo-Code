
	var { promisify: $9e } = require("util"),
		Y9e = $E(),
		{ buildMockDispatch: K9e } = ib(),
		{
			kDispatches: vie,
			kMockAgent: Eie,
			kClose: bie,
			kOriginalClose: xie,
			kOrigin: _ie,
			kOriginalDispatch: J9e,
			kConnected: cV,
		} = v0(),
		{ MockInterceptor: z9e } = lV(),
		wie = Qn(),
		{ InvalidArgumentError: j9e } = Vr(),
		uV = class extends Y9e {
			constructor(t, r) {
				if ((super(t, r), !r || !r.agent || typeof r.agent.dispatch != "function"))
					throw new j9e("Argument opts.agent must implement Agent")
				;(this[Eie] = r.agent),
					(this[_ie] = t),
					(this[vie] = []),
					(this[cV] = 1),
					(this[J9e] = this.dispatch),
					(this[xie] = this.close.bind(this)),
					(this.dispatch = K9e.call(this)),
					(this.close = this[bie])
			}
			get [wie.kConnected]() {
				return this[cV]
			}
			intercept(t) {
				return new z9e(t, this[vie])
			}
			async [bie]() {
				await $9e(this[xie])(), (this[cV] = 0), this[Eie][wie.kClients].delete(this[_ie])
			}
		}