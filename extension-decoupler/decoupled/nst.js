
	function Nst(e, t) {
		if (
			(er("endReadableNT", e.endEmitted, e.length),
			!e.endEmitted && e.length === 0 && ((e.endEmitted = !0), (t.readable = !1), t.emit("end"), e.autoDestroy))
		) {
			var r = t._writableState
			;(!r || (r.autoDestroy && r.finished)) && t.destroy()
		}
	}