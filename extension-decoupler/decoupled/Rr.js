
	function rR(e) {
		;(e._writableState && !e._writableState.emitClose) ||
			(e._readableState && !e._readableState.emitClose) ||
			e.emit("close")
	}