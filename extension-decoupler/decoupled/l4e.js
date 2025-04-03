
	function l4e(e) {
		let t = null,
			r = null,
			n = null,
			i = Ste("content-type", e)
		if (i === null) return "failure"
		for (let s of i) {
			let o = yWe(s)
			o === "failure" ||
				o.essence === "*/*" ||
				((n = o),
				n.essence !== r
					? ((t = null), n.parameters.has("charset") && (t = n.parameters.get("charset")), (r = n.essence))
					: !n.parameters.has("charset") && t !== null && n.parameters.set("charset", t))
		}
		return n ?? "failure"
	}