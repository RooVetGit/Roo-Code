
	function Hit(e) {
		var t = this.lastTotal - this.lastNeed,
			r = Vit(this, e, t)
		if (r !== void 0) return r
		if (this.lastNeed <= e.length)
			return e.copy(this.lastChar, t, 0, this.lastNeed), this.lastChar.toString(this.encoding, 0, this.lastTotal)
		e.copy(this.lastChar, t, 0, e.length), (this.lastNeed -= e.length)
	}