
	function $4e(e, t) {
		let [r, n] = t.stream.tee()
		return GO && $O.register(e, new WeakRef(r)), (t.stream = r), { stream: n, length: t.length, source: t.source }
	}