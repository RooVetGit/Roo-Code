
	function Xte(e) {
		let { socket: t, timeoutType: r, client: n, paused: i } = e.deref()
		r === l0
			? (!t[Yf] || t.writableNeedDrain || n[Os] > 1) &&
				(ht(!i, "cannot be paused while waiting for headers"), Bt.destroy(t, new Z4e()))
			: r === QB
				? i || Bt.destroy(t, new eGe())
				: r === eq && (ht(n[Os] === 0 && n[PB]), Bt.destroy(t, new o0("socket idle timeout")))
	}