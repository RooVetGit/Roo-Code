
	function Whe(e, t, r, n, i) {
		er("readableAddChunk", t)
		var s = e._readableState
		if (t === null) (s.reading = !1), Tst(e, s)
		else {
			var o
			if ((i || (o = Bst(s, t)), o)) Kb(e, o)
			else if (s.objectMode || (t && t.length > 0))
				if (
					(typeof t != "string" && !s.objectMode && Object.getPrototypeOf(t) !== lR.prototype && (t = yst(t)),
					n)
				)
					s.endEmitted ? Kb(e, new Ist()) : sH(e, s, t, !0)
				else if (s.ended) Kb(e, new _st())
				else {
					if (s.destroyed) return !1
					;(s.reading = !1),
						s.decoder && !r
							? ((t = s.decoder.write(t)), s.objectMode || t.length !== 0 ? sH(e, s, t, !1) : aH(e, s))
							: sH(e, s, t, !1)
				}
			else n || ((s.reading = !1), aH(e, s))
		}
		return !s.ended && (s.length < s.highWaterMark || s.length === 0)
	}