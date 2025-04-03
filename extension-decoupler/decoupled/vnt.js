
	function Vnt(e) {
		if (JT.call(e, "strict")) {
			let t = e.strict
			if (typeof t != "boolean") throw new TypeError('The "strict" argument must be of type boolean')
			if (t)
				return (r) => {
					let n = `Object can not safely be stringified. Received type ${typeof r}`
					throw (typeof r != "function" && (n += ` (${r.toString()})`), new Error(n))
				}
		}
	}