
	function Dst(e) {
		return (
			e >= Ohe
				? (e = Ohe)
				: (e--, (e |= e >>> 1), (e |= e >>> 2), (e |= e >>> 4), (e |= e >>> 8), (e |= e >>> 16), e++),
			e
		)
	}