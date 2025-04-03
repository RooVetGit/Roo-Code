
	function Tit(e, t, r, n) {
		var i = Dit(t, n, r)
		if (i != null) {
			if (!(isFinite(i) && Math.floor(i) === i) || i < 0) {
				var s = n ? r : "highWaterMark"
				throw new Bit(s, i)
			}
			return Math.floor(i)
		}
		return e.objectMode ? 16 : 16 * 1024
	}