
	function Tgt(e) {
		e ? (process.env.DEBUG = e) : delete process.env.DEBUG
	}