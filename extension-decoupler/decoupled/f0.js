
var f0 = x((bIt, $re) => {
	"use strict"
	var { PoolBase: G8e, kClients: Vre, kNeedDrain: $8e, kAddClient: Y8e, kGetDispatcher: K8e } = Cq(),
		J8e = $E(),
		{ InvalidArgumentError: vq } = Vr(),
		Hre = Xt(),
		{ kUrl: Wre, kInterceptors: z8e } = Qn(),
		j8e = IE(),
		Eq = Symbol("options"),
		bq = Symbol("connections"),
		Gre = Symbol("factory")
	function Z8e(e, t) {
		return new J8e(e, t)
	}
	var xq = class extends G8e {
		constructor(
			t,
			{
				connections: r,
				factory: n = Z8e,
				connect: i,
				connectTimeout: s,
				tls: o,
				maxCachedSessions: a,
				socketPath: l,
				autoSelectFamily: c,
				autoSelectFamilyAttemptTimeout: u,
				allowH2: f,
				...p
			} = {},
		) {
			if ((super(), r != null && (!Number.isFinite(r) || r < 0))) throw new vq("invalid connections")
			if (typeof n != "function") throw new vq("factory must be a function.")
			if (i != null && typeof i != "function" && typeof i != "object")
				throw new vq("connect must be a function or an object")
			typeof i != "function" &&
				(i = j8e({
					...o,
					maxCachedSessions: a,
					allowH2: f,
					socketPath: l,
					timeout: s,
					...(c ? { autoSelectFamily: c, autoSelectFamilyAttemptTimeout: u } : void 0),
					...i,
				})),
				(this[z8e] = p.interceptors?.Pool && Array.isArray(p.interceptors.Pool) ? p.interceptors.Pool : []),
				(this[bq] = r || null),
				(this[Wre] = Hre.parseOrigin(t)),
				(this[Eq] = { ...Hre.deepClone(p), connect: i, allowH2: f }),
				(this[Eq].interceptors = p.interceptors ? { ...p.interceptors } : void 0),
				(this[Gre] = n)
		}
		[K8e]() {
			for (let t of this[Vre]) if (!t[$8e]) return t
			if (!this[bq] || this[Vre].length < this[bq]) {
				let t = this[Gre](this[Wre], this[Eq])
				return this[Y8e](t), t
			}
		}
	}
	$re.exports = xq
})