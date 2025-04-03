
	function Toe(e) {
		return (
			typeof e == "number" && (e = new Date(e)),
			`${KKe[e.getUTCDay()]}, ${LD[e.getUTCDate()]} ${
				JKe[e.getUTCMonth()]
			} ${e.getUTCFullYear()} ${LD[e.getUTCHours()]}:${LD[e.getUTCMinutes()]}:${LD[e.getUTCSeconds()]} GMT`
		)
	}