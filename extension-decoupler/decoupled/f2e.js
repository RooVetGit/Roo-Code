
	function F2e(e) {
		return tJ.test(e)
			? e.replace(tJ, (t) => {
					switch (t) {
						case "&":
							return "&amp;"
						case "<":
							return "&lt;"
						case ">":
							return "&gt;"
						case "\xA0":
							return "&nbsp;"
					}
				})
			: e
	}