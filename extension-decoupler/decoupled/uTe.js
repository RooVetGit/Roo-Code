
	function Ute(e, t) {
		BB(e[t.position - 1] === 34)
		let r = r0((n) => n !== 10 && n !== 13 && n !== 34, e, t)
		return e[t.position] !== 34
			? null
			: (t.position++,
				(r = new TextDecoder()
					.decode(r)
					.replace(
						/%0A/gi,
						`
`,
					)
					.replace(/%0D/gi, "\r")
					.replace(/%22/g, '"')),
				r)
	}