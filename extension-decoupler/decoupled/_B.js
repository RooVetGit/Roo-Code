
	function _b(e) {
		if (!(e === 8 || e === 16 || e === 24 || e === 32))
			throw new Error("Only 8, 16, 24, or 32 bits supported: " + e)
	}