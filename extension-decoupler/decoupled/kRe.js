
	var { BalancedPoolMissingUpstreamError: X8e, InvalidArgumentError: e6e } = Vr(),
		{
			PoolBase: t6e,
			kClients: qs,
			kNeedDrain: JE,
			kAddClient: r6e,
			kRemoveClient: n6e,
			kGetDispatcher: i6e,
		} = Cq(),
		s6e = f0(),
		{ kUrl: _q, kInterceptors: o6e } = Qn(),
		{ parseOrigin: Yre } = Xt(),
		Kre = Symbol("factory"),
		KB = Symbol("options"),
		Jre = Symbol("kGreatestCommonDivisor"),
		cp = Symbol("kCurrentWeight"),
		up = Symbol("kIndex"),
		sl = Symbol("kWeight"),
		JB = Symbol("kMaxWeightPerServer"),
		zB = Symbol("kErrorPenalty")