
	function Yit(e) {
		var t = e && e.length ? this.write(e) : ""
		if (this.lastNeed) {
			var r = this.lastTotal - this.lastNeed
			return t + this.lastChar.toString("utf16le", 0, r)
		}
		return t
	}