
	function Pgt(e, t = Ra.READABLE) {
		return Ngt(e, (t & Ra.FILE) > 0, (t & Ra.FOLDER) > 0)
	}