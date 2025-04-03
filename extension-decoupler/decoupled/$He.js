
	function $he(e) {
		var t = e._readableState
		;(t.readableListening = e.listenerCount("readable") > 0),
			t.resumeScheduled && !t.paused ? (t.flowing = !0) : e.listenerCount("data") > 0 && e.resume()
	}