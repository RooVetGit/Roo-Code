
	function RKe(e) {
		let [t, r, n] = e
		return t === 239 && r === 187 && n === 191
			? "UTF-8"
			: t === 254 && r === 255
				? "UTF-16BE"
				: t === 255 && r === 254
					? "UTF-16LE"
					: null
	}