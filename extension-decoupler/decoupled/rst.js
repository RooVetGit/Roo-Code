
	function Rst(e, t) {
		for (; !t.reading && !t.ended && (t.length < t.highWaterMark || (t.flowing && t.length === 0)); ) {
			var r = t.length
			if ((er("maybeReadMore read 0"), e.read(0), r === t.length)) break
		}
		t.readingMore = !1
	}