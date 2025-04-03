
	function Vgt(e) {
		try {
			e ? ka.storage.setItem("debug", e) : ka.storage.removeItem("debug")
		} catch {}
	}