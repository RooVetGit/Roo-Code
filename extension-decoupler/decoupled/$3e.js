
	function $3e(e, t) {
		return "addEventListener" in e
			? (e.addEventListener("abort", t, { once: !0 }), () => e.removeEventListener("abort", t))
			: (e.addListener("abort", t), () => e.removeListener("abort", t))
	}