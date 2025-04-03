
	var { kProxy: v6e, kClose: E6e, kDestroy: b6e, kInterceptors: x6e } = Qn(),
		{ URL: zE } = require("url"),
		_6e = h0(),
		w6e = f0(),
		I6e = zm(),
		{ InvalidArgumentError: eD, RequestAbortedError: S6e, SecureProxyConnectionError: B6e } = Vr(),
		sne = IE(),
		ZB = Symbol("proxy agent"),
		XB = Symbol("proxy client"),
		jE = Symbol("proxy headers"),
		Bq = Symbol("request tls settings"),
		one = Symbol("proxy tls settings"),
		ane = Symbol("connect endpoint function")