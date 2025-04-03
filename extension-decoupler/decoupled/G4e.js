
	function G4e(e, t = !1) {
		return (
			e instanceof ReadableStream &&
				(HO(!FE.isDisturbed(e), "The body has already been consumed."), HO(!e.locked, "The stream is locked.")),
			Yte(e, t)
		)
	}