
	function _it(e, t) {
		var r = e._readableState,
			n = e._writableState
		;(r && r.autoDestroy) || (n && n.autoDestroy) ? e.destroy(t) : e.emit("error", t)
	}