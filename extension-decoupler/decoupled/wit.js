
	function Wit(e, t) {
		var r = qit(this, e, t)
		if (!this.lastNeed) return e.toString("utf8", t)
		this.lastTotal = r
		var n = e.length - (r - this.lastNeed)
		return e.copy(this.lastChar, 0, n), e.toString("utf8", t, n)
	}