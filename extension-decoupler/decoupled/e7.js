
	function e7(e) {
		;(this.options = e),
			(this._keep = []),
			(this._remove = []),
			(this.blankRule = { replacement: e.blankReplacement }),
			(this.keepReplacement = e.keepReplacement),
			(this.defaultRule = { replacement: e.defaultReplacement }),
			(this.array = [])
		for (var t in e.rules) this.array.push(e.rules[t])
	}