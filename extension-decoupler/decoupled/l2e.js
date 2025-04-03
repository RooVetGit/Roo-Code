
	function L2e(e, t) {
		var r = ""
		switch (e.nodeType) {
			case 1:
				var n = e.namespaceURI,
					i = n === Yg.HTML,
					s = i || n === Yg.SVG || n === Yg.MATHML ? e.localName : e.tagName
				r += "<" + s
				for (var o = 0, a = e._numattrs; o < a; o++) {
					var l = e._attr(o)
					;(r += " " + N2e(l)), l.value !== void 0 && (r += '="' + Q2e(l.value) + '"')
				}
				if (((r += ">"), !(i && k2e[s]))) {
					var c = e.serialize()
					eJ[s.toUpperCase()] && (c = iJ(c, s)),
						i &&
							M2e[s] &&
							c.charAt(0) ===
								`
` &&
							(r += `
`),
						(r += c),
						(r += "</" + s + ">")
				}
				break
			case 3:
			case 4:
				var u
				t.nodeType === 1 && t.namespaceURI === Yg.HTML ? (u = t.tagName) : (u = ""),
					eJ[u] || (u === "NOSCRIPT" && t.ownerDocument._scripting_enabled)
						? (r += e.data)
						: (r += F2e(e.data))
				break
			case 8:
				r += "<!--" + sJ(e.data) + "-->"
				break
			case 7:
				let f = oJ(e.data)
				r += "<?" + e.target + " " + f + "?>"
				break
			case 10:
				;(r += "<!DOCTYPE " + e.name), (r += ">")
				break
			default:
				nJ.InvalidStateError()
		}
		return r
	}