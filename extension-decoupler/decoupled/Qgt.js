
	function qgt(e) {
		if (
			((e[0] =
				(this.useColors ? "%c" : "") +
				this.namespace +
				(this.useColors ? " %c" : " ") +
				e[0] +
				(this.useColors ? "%c " : " ") +
				"+" +
				wM.exports.humanize(this.diff)),
			!this.useColors)
		)
			return
		let t = "color: " + this.color
		e.splice(1, 0, t, "color: inherit")
		let r = 0,
			n = 0
		e[0].replace(/%[a-zA-Z%]/g, (i) => {
			i !== "%%" && (r++, i === "%c" && (n = r))
		}),
			e.splice(n, 0, t)
	}