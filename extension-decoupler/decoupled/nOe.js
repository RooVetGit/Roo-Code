
var Noe = x((CSt, Qoe) => {
	"use strict"
	var { parseSetCookie: nJe } = Moe(),
		{ stringify: iJe } = GV(),
		{ webidl: fr } = ys(),
		{ Headers: OD } = pp()
	function sJe(e) {
		fr.argumentLengthCheck(arguments, 1, "getCookies"), fr.brandCheck(e, OD, { strict: !1 })
		let t = e.get("cookie"),
			r = {}
		if (!t) return r
		for (let n of t.split(";")) {
			let [i, ...s] = n.split("=")
			r[i.trim()] = s.join("=")
		}
		return r
	}
	function oJe(e, t, r) {
		fr.brandCheck(e, OD, { strict: !1 })
		let n = "deleteCookie"
		fr.argumentLengthCheck(arguments, 2, n),
			(t = fr.converters.DOMString(t, n, "name")),
			(r = fr.converters.DeleteCookieAttributes(r)),
			Foe(e, { name: t, value: "", expires: new Date(0), ...r })
	}
	function aJe(e) {
		fr.argumentLengthCheck(arguments, 1, "getSetCookies"), fr.brandCheck(e, OD, { strict: !1 })
		let t = e.getSetCookie()
		return t ? t.map((r) => nJe(r)) : []
	}
	function Foe(e, t) {
		fr.argumentLengthCheck(arguments, 2, "setCookie"),
			fr.brandCheck(e, OD, { strict: !1 }),
			(t = fr.converters.Cookie(t))
		let r = iJe(t)
		r && e.append("Set-Cookie", r)
	}
	fr.converters.DeleteCookieAttributes = fr.dictionaryConverter([
		{
			converter: fr.nullableConverter(fr.converters.DOMString),
			key: "path",
			defaultValue: () => null,
		},
		{
			converter: fr.nullableConverter(fr.converters.DOMString),
			key: "domain",
			defaultValue: () => null,
		},
	])
	fr.converters.Cookie = fr.dictionaryConverter([
		{ converter: fr.converters.DOMString, key: "name" },
		{ converter: fr.converters.DOMString, key: "value" },
		{
			converter: fr.nullableConverter((e) =>
				typeof e == "number" ? fr.converters["unsigned long long"](e) : new Date(e),
			),
			key: "expires",
			defaultValue: () => null,
		},
		{
			converter: fr.nullableConverter(fr.converters["long long"]),
			key: "maxAge",
			defaultValue: () => null,
		},
		{
			converter: fr.nullableConverter(fr.converters.DOMString),
			key: "domain",
			defaultValue: () => null,
		},
		{
			converter: fr.nullableConverter(fr.converters.DOMString),
			key: "path",
			defaultValue: () => null,
		},
		{
			converter: fr.nullableConverter(fr.converters.boolean),
			key: "secure",
			defaultValue: () => null,
		},
		{
			converter: fr.nullableConverter(fr.converters.boolean),
			key: "httpOnly",
			defaultValue: () => null,
		},
		{
			converter: fr.converters.USVString,
			key: "sameSite",
			allowedValues: ["Strict", "Lax", "None"],
		},
		{
			converter: fr.sequenceConverter(fr.converters.DOMString),
			key: "unparsed",
			defaultValue: () => new Array(0),
		},
	])
	Qoe.exports = {
		getCookies: sJe,
		deleteCookie: oJe,
		getSetCookies: aJe,
		setCookie: Foe,
	}
})