
	function Kgt(e) {
		let { namespace: t, useColors: r } = this
		if (r) {
			let n = this.color,
				i = "\x1B[3" + (n < 8 ? n : "8;5;" + n),
				s = `  ${i};1m${t} \x1B[0m`
			;(e[0] =
				s +
				e[0]
					.split(
						`
`,
					)
					.join(
						`
` + s,
					)),
				e.push(i + "m+" + SM.exports.humanize(this.diff) + "\x1B[0m")
		} else e[0] = Jgt() + t + " " + e[0]
	}