
	function Doe(e) {
		for (let t = 0; t < e.length; ++t) {
			let r = e.charCodeAt(t)
			if (r < 32 || r === 127 || r === 59) throw new Error("Invalid cookie path")
		}
	}