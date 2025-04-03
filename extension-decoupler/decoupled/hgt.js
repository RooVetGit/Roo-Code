
	function Hgt() {
		let e
		try {
			e = ka.storage.getItem("debug")
		} catch {}
		return !e && typeof process < "u" && "env" in process && (e = process.env.DEBUG), e
	}