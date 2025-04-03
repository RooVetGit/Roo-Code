
	function M3e(e, t) {
		e == null ||
			!hB(e) ||
			Eee(e) ||
			(typeof e.destroy == "function"
				? (Object.getPrototypeOf(e).constructor === A3e && (e.socket = null), e.destroy(t))
				: t &&
					queueMicrotask(() => {
						e.emit("error", t)
					}),
			e.destroyed !== !0 && (e[gee] = !0))
	}