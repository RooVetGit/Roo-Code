
	function Yhe(e, t) {
		if (t.length === 0) return null
		var r
		return (
			t.objectMode
				? (r = t.buffer.shift())
				: !e || e >= t.length
					? (t.decoder
							? (r = t.buffer.join(""))
							: t.buffer.length === 1
								? (r = t.buffer.first())
								: (r = t.buffer.concat(t.length)),
						t.buffer.clear())
					: (r = t.buffer.consume(e, t.decoder)),
			r
		)
	}