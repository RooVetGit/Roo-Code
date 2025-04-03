
	function Foe(e, t) {
		fr.argumentLengthCheck(arguments, 2, "setCookie"),
			fr.brandCheck(e, OD, { strict: !1 }),
			(t = fr.converters.Cookie(t))
		let r = iJe(t)
		r && e.append("Set-Cookie", r)
	}