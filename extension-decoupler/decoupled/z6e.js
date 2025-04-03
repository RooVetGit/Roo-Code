
	function Z6e(e) {
		if (e.body === null) return
		let { _readableState: t } = e.stream
		if (t.bufferIndex) {
			let r = t.bufferIndex,
				n = t.buffer.length
			for (let i = r; i < n; i++) Pq(e, t.buffer[i])
		} else for (let r of t.buffer) Pq(e, r)
		for (
			t.endEmitted
				? _ne(this[pa])
				: e.stream.on("end", function () {
						_ne(this[pa])
					}),
				e.stream.resume();
			e.stream.read() != null;

		);
	}