
	function Ghe(e) {
		var t = e._readableState
		er("emitReadable_", t.destroyed, t.length, t.ended),
			!t.destroyed && (t.length || t.ended) && (e.emit("readable"), (t.emittedReadable = !1)),
			(t.needReadable = !t.flowing && !t.ended && t.length <= t.highWaterMark),
			cH(e)
	}