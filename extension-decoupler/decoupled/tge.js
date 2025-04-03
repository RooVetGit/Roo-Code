
	function tge(e, t) {
		t.bufferProcessing = !0
		var r = t.bufferedRequest
		if (e._writev && r && r.next) {
			var n = t.bufferedRequestCount,
				i = new Array(n),
				s = t.corkedRequestsFree
			s.entry = r
			for (var o = 0, a = !0; r; ) (i[o] = r), r.isBuf || (a = !1), (r = r.next), (o += 1)
			;(i.allBuffers = a),
				hH(e, t, !0, t.length, i, "", s.finish),
				t.pendingcb++,
				(t.lastBufferedRequest = null),
				s.next ? ((t.corkedRequestsFree = s.next), (s.next = null)) : (t.corkedRequestsFree = new Xhe(t)),
				(t.bufferedRequestCount = 0)
		} else {
			for (; r; ) {
				var l = r.chunk,
					c = r.encoding,
					u = r.callback,
					f = t.objectMode ? 1 : l.length
				if ((hH(e, t, !1, f, l, c, u), (r = r.next), t.bufferedRequestCount--, t.writing)) break
			}
			r === null && (t.lastBufferedRequest = null)
		}
		;(t.bufferedRequest = r), (t.bufferProcessing = !1)
	}