
	function qhe(e, t) {
		return e <= 0 || (t.length === 0 && t.ended)
			? 0
			: t.objectMode
				? 1
				: e !== e
					? t.flowing && t.length
						? t.buffer.head.data.length
						: t.length
					: (e > t.highWaterMark && (t.highWaterMark = Dst(e)),
						e <= t.length ? e : t.ended ? t.length : ((t.needReadable = !0), 0))
	}