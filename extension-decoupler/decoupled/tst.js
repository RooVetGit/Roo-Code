
	function Tst(e, t) {
		if ((er("onEofChunk"), !t.ended)) {
			if (t.decoder) {
				var r = t.decoder.end()
				r && r.length && (t.buffer.push(r), (t.length += t.objectMode ? 1 : r.length))
			}
			;(t.ended = !0),
				t.sync ? uR(e) : ((t.needReadable = !1), t.emittedReadable || ((t.emittedReadable = !0), Ghe(e)))
		}
	}