
	var { promisify: Z9e } = require("util"),
		X9e = f0(),
		{ buildMockDispatch: e$e } = ib(),
		{
			kDispatches: Sie,
			kMockAgent: Bie,
			kClose: Die,
			kOriginalClose: Tie,
			kOrigin: Rie,
			kOriginalDispatch: t$e,
			kConnected: fV,
		} = v0(),
		{ MockInterceptor: r$e } = lV(),
		kie = Qn(),
		{ InvalidArgumentError: n$e } = Vr(),
		hV = class extends X9e {
			constructor(t, r) {
				if ((super(t, r), !r || !r.agent || typeof r.agent.dispatch != "function"))
					throw new n$e("Argument opts.agent must implement Agent")
				;(this[Bie] = r.agent),
					(this[Rie] = t),
					(this[Sie] = []),
					(this[fV] = 1),
					(this[t$e] = this.dispatch),
					(this[Tie] = this.close.bind(this)),
					(this.dispatch = e$e.call(this)),
					(this.close = this[Die])
			}
			get [kie.kConnected]() {
				return this[fV]
			}
			intercept(t) {
				return new r$e(t, this[Sie])
			}
			async [Die]() {
				await Z9e(this[Tie])(), (this[fV] = 0), this[Bie][kie.kClients].delete(this[Rie])
			}
		}