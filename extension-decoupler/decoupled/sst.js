
	function Sst(e, t, r) {
		if (typeof e.prependListener == "function") return e.prependListener(t, r)
		!e._events || !e._events[t]
			? e.on(t, r)
			: Array.isArray(e._events[t])
				? e._events[t].unshift(r)
				: (e._events[t] = [r, e._events[t]])
	}