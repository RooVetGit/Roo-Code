
	function Yge(e, t, r) {
		if (t) return e.emit("error", t)
		if ((r != null && e.push(r), e._writableState.length)) throw new Tat()
		if (e._transformState.transforming) throw new Dat()
		return e.push(null)
	}