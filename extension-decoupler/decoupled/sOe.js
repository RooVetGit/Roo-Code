
	function Soe(e) {
		for (let t = 0; t < e.length; ++t) {
			let r = e.charCodeAt(t)
			if (
				r < 33 ||
				r > 126 ||
				r === 34 ||
				r === 40 ||
				r === 41 ||
				r === 60 ||
				r === 62 ||
				r === 64 ||
				r === 44 ||
				r === 59 ||
				r === 58 ||
				r === 92 ||
				r === 47 ||
				r === 91 ||
				r === 93 ||
				r === 63 ||
				r === 61 ||
				r === 123 ||
				r === 125
			)
				throw new Error("Invalid cookie name")
		}
	}