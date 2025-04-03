
	function Git(e) {
		var t = e && e.length ? this.write(e) : ""
		return this.lastNeed ? t + "\uFFFD" : t
	}